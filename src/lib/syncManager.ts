/**
 * APEX MEDI SALES — Real-Time Database Synchronization & Auto-Refresh Manager
 * 
 * Guarantees Neon PostgreSQL as the single source of truth across all tabs,
 * pages, and user sessions.
 * 
 * Features:
 * - Cross-tab communication via BroadcastChannel (with localStorage fallback)
 * - Auto-refresh polling (15s default, 30s background)
 * - Immediate refresh on tab focus / document visibility change
 * - Fast version polling (/api/sync/version) to detect direct external DB changes
 * - Silent background synchronization without resetting forms, search inputs, or active modals
 * - Centralized sync state for header status indicators
 */

export type SyncState = 'synced' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncState;
  lastSyncTime: Date | null;
  lastError: string | null;
  isNeonConnected: boolean;
  version: string;
}

type SyncCallback = (status: SyncStatus) => void;
type MutationCallback = (payload: { entity: string; timestamp: number }) => void;

class SyncManager {
  private status: SyncStatus = {
    state: 'synced',
    lastSyncTime: new Date(),
    lastError: null,
    isNeonConnected: true,
    version: 'init',
  };

  private syncListeners: Set<SyncCallback> = new Set();
  private mutationListeners: Set<MutationCallback> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollIntervalId: any = null;
  private isTabActive: boolean = true;
  private isSyncingInProgress: boolean = false;
  private channelName = 'apex_medi_sales_sync_channel';
  private storageKey = 'apex_sync_mutation_event';

  constructor() {
    this.initCrossTabChannel();
    this.initVisibilityListeners();
    this.startAutoRefresh();
  }

  /**
   * Initialize BroadcastChannel with localStorage storage-event fallback for multi-tab sync
   */
  private initCrossTabChannel() {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      } catch (e) {
        console.warn('[SyncManager] BroadcastChannel not supported, falling back to storage events');
      }
    }

    // Fallback: window storage event
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          this.handleIncomingBroadcast(data);
        } catch {
          // ignore parsing error
        }
      }
    });

    // Check initial online status
    window.addEventListener('online', () => {
      this.status.state = 'synced';
      this.notifyListeners();
      this.triggerImmediateSync();
    });

    window.addEventListener('offline', () => {
      this.status.state = 'offline';
      this.notifyListeners();
    });
  }

  /**
   * Listen for tab focus / visibility to refresh data when returning to the tab
   */
  private initVisibilityListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.isTabActive = true;
        // User just returned to tab: trigger immediate sync
        this.triggerImmediateSync();
        this.restartPolling(15000);
      } else {
        this.isTabActive = false;
        // Tab hidden: slow down polling to save resources
        this.restartPolling(45000);
      }
    });

    window.addEventListener('focus', () => {
      this.isTabActive = true;
      this.triggerImmediateSync();
    });
  }

  /**
   * Handle incoming broadcast message from other tabs
   */
  private handleIncomingBroadcast(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'DATA_MUTATED') {
      // Another tab mutated data (e.g. made a sale or imported a bill)
      this.triggerImmediateSync(true);
      for (const listener of this.mutationListeners) {
        try {
          listener({ entity: data.entity || 'all', timestamp: data.timestamp || Date.now() });
        } catch (err) {
          console.error('[SyncManager] Error in mutation listener:', err);
        }
      }
    } else if (data.type === 'SYNC_REQUEST') {
      this.triggerImmediateSync();
    }
  }

  /**
   * Notify other tabs that local data was modified
   */
  public notifyMutation(entity: string) {
    const payload = {
      type: 'DATA_MUTATED',
      entity,
      timestamp: Date.now(),
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('[SyncManager] BroadcastChannel send failed:', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
      } catch {
        // ignore localStorage errors
      }
    }

    // Trigger local listeners too
    for (const listener of this.mutationListeners) {
      try {
        listener({ entity, timestamp: payload.timestamp });
      } catch (err) {
        console.error('[SyncManager] Local mutation callback error:', err);
      }
    }

    // Trigger sync check
    this.triggerImmediateSync(true);
  }

  /**
   * Trigger immediate synchronization with Neon PostgreSQL
   */
  public async triggerImmediateSync(force: boolean = false): Promise<boolean> {
    if (this.isSyncingInProgress) return false;

    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status.state = 'offline';
      this.notifyListeners();
      return false;
    }

    this.isSyncingInProgress = true;
    this.status.state = 'syncing';
    this.notifyListeners();

    try {
      // 1. Fetch version / sync status from server
      const res = await fetch('/api/sync/version', {
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`Sync version check failed: ${res.statusText}`);
      }

      const syncVer = await res.json();
      const versionChanged = syncVer.version !== this.status.version;

      this.status = {
        state: 'synced',
        lastSyncTime: new Date(),
        lastError: null,
        isNeonConnected: true,
        version: syncVer.version,
      };

      this.notifyListeners();

      // If version changed or forced, notify listeners of data change
      if (versionChanged || force) {
        for (const listener of this.mutationListeners) {
          try {
            listener({ entity: 'neon_sync', timestamp: Date.now() });
          } catch (err) {
            console.error('[SyncManager] Error notifying mutation listeners:', err);
          }
        }
      }

      this.isSyncingInProgress = false;
      return true;
    } catch (err: any) {
      console.warn('[SyncManager] Sync failed:', err.message);
      this.status = {
        ...this.status,
        state: 'error',
        lastError: err.message || 'Sync failed',
      };
      this.notifyListeners();
      this.isSyncingInProgress = false;
      return false;
    }
  }

  /**
   * Force server to re-query Neon PostgreSQL and refresh local state
   */
  public async forceResync(): Promise<boolean> {
    if (this.isSyncingInProgress) return false;

    this.isSyncingInProgress = true;
    this.status.state = 'syncing';
    this.notifyListeners();

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('apex_token') : null;
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/sync/force', {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        throw new Error('Force resync request failed');
      }

      const syncVer = await res.json();
      this.status = {
        state: 'synced',
        lastSyncTime: new Date(),
        lastError: null,
        isNeonConnected: true,
        version: syncVer.version,
      };

      this.notifyListeners();

      // Notify all tabs and components
      this.notifyMutation('forced_neon_sync');
      this.isSyncingInProgress = false;
      return true;
    } catch (err: any) {
      this.status = {
        ...this.status,
        state: 'error',
        lastError: err.message || 'Force resync failed',
      };
      this.notifyListeners();
      this.isSyncingInProgress = false;
      return false;
    }
  }

  /**
   * Start periodic auto-refresh timer (default 15s)
   */
  private startAutoRefresh(intervalMs: number = 15000) {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(() => {
      this.triggerImmediateSync();
    }, intervalMs);
  }

  private restartPolling(intervalMs: number) {
    this.startAutoRefresh(intervalMs);
  }

  /**
   * Subscribe to status updates (synced, syncing, error, offline)
   */
  public subscribeStatus(callback: SyncCallback): () => void {
    this.syncListeners.add(callback);
    callback(this.status);
    return () => {
      this.syncListeners.delete(callback);
    };
  }

  /**
   * Subscribe to data mutation events (when another tab or DB updates)
   */
  public subscribeMutations(callback: MutationCallback): () => void {
    this.mutationListeners.add(callback);
    return () => {
      this.mutationListeners.delete(callback);
    };
  }

  /**
   * Notify all status listeners
   */
  private notifyListeners() {
    for (const listener of this.syncListeners) {
      try {
        listener({ ...this.status });
      } catch (err) {
        console.error('[SyncManager] Error in status listener:', err);
      }
    }
  }

  public getStatus(): SyncStatus {
    return { ...this.status };
  }
}

export const syncManager = new SyncManager();
