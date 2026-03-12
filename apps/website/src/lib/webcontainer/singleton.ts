/**
 * WebContainer singleton manager
 *
 * WebContainer only allows one instance per browser tab, so we need to
 * manage it as a singleton that persists across React component mounts/unmounts
 * and Next.js page navigations.
 *
 * We use:
 * - window object to store the WebContainer instance (survives page navigation)
 * - sessionStorage to persist the installation status
 */

import { WebContainer } from '@webcontainer/api';

const DEPS_INSTALLED_KEY = 'webcontainer_deps_installed';

// Extend Window interface to include our WebContainer instance
declare global {
  interface Window {
    __webcontainer_instance?: WebContainer;
    __webcontainer_boot_promise?: Promise<WebContainer>;
  }
}

/**
 * Get or create the WebContainer instance
 *
 * This ensures only one WebContainer is ever booted, even if called
 * multiple times or from multiple components or across page navigations.
 *
 * Stores the instance on window object so it persists across Next.js
 * page transitions.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (typeof window === 'undefined') {
    throw new Error('WebContainer can only be used in the browser');
  }

  // If already booted, return the instance from window
  if (window.__webcontainer_instance) {
    return window.__webcontainer_instance;
  }

  // If boot is in progress, wait for it
  if (window.__webcontainer_boot_promise) {
    return window.__webcontainer_boot_promise;
  }

  // Start booting — fresh instance has no node_modules, so clear the deps flag
  sessionStorage.removeItem(DEPS_INSTALLED_KEY);
  window.__webcontainer_boot_promise = WebContainer.boot();
  window.__webcontainer_instance = await window.__webcontainer_boot_promise;
  window.__webcontainer_boot_promise = undefined;

  return window.__webcontainer_instance;
}

/**
 * Check if WebContainer is already booted
 * Checks window object for persistence across page navigations
 */
export function isWebContainerBooted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__webcontainer_instance !== undefined;
}

/**
 * Check if npm install has been completed
 * Uses sessionStorage to persist across page navigations
 */
export function isDependenciesInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(DEPS_INSTALLED_KEY) === 'true';
}

/**
 * Mark dependencies as installed
 * Persists to sessionStorage so it survives page navigations
 */
export function markDependenciesInstalled(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEPS_INSTALLED_KEY, 'true');
}

/**
 * Reset the singleton (for testing only)
 */
export function resetWebContainer(): void {
  if (typeof window !== 'undefined') {
    window.__webcontainer_instance = undefined;
    window.__webcontainer_boot_promise = undefined;
    sessionStorage.removeItem(DEPS_INSTALLED_KEY);
  }
}
