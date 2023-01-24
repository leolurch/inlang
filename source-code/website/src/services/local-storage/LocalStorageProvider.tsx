/**
 * This file contains the local storage provider and also non reactive versions.
 *
 * This custom implementation uses only one key in the actual local storage and works with JSON.stringify() / .parse() to emulate the behaviour of the normal localStorage interface.
 */

import {
  createContext,
  JSXElement,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { createStore, reconcile, SetStoreFunction } from "solid-js/store";
import { getUserInfo } from "../auth/logic.telefunc.js";
import {
  defaultLocalStorage,
  LocalStorageSchema,
  SetLocalStorage,
} from "./schema.js";

const LocalStorageContext = createContext();

const LOCAL_STORAGE_KEY = "inlang-local-storage";

/**
 * Retrieves (gets) the local storage.
 *
 * This function is supposed to be used in a non-reactive
 * environment (regular JS/TS, not JSX). If a reactive
 * version is required, use `useLocalStorage()` instead.
 */
export function getLocalStorage(): LocalStorageSchema | undefined {
  const json = localStorage.getItem(LOCAL_STORAGE_KEY);
  // we all love javascript. error prevention here if cache contains "undefined"
  if (json && json !== "undefined") {
    return JSON.parse(json);
  }
}

/**
 * Updates a key using inlangs custom local storage structure.
 *
 * This is the non-reactive version of `useLocalStorage()` (regular JS/TS, not JSX).
 * Use the reactive version if you are in a JSX environment.
 * @param key The key to update
 * @param value The value to update the key with
 */
export const setLocalStorage: SetLocalStorage = (key, value) => {
  if (!key) {
    return;
  }

  const store = getLocalStorage();

  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify({ ...store, [key]: value })
  );
};

/**
 * Store that provides access to the local storage.
 *
 * Use this function in the context of components.
 * If you need to retrieve the localStorage outside
 * of JSX, use `getLocalStorage()` instead.
 */
export function useLocalStorage(): [
  get: LocalStorageSchema,
  set: SetStoreFunction<LocalStorageSchema>
] {
  return useContext(LocalStorageContext as any);
}

// use strg-f to find the usage of this provider
export function LocalStorageProvider(props: { children: JSXElement }) {
  const [store, setOriginStore] =
    createStore<LocalStorageSchema>(defaultLocalStorage);

  /** custom setStore to trigger localStorage.setItem on change */
  const setStore: typeof setOriginStore = (...args: any) => {
    // @ts-ignore
    setOriginStore(...args);
    // write to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  };

  // read from local storage on mount
  onMount(() => {
    const storage = getLocalStorage();
    if (storage) {
      setStore(storage);
    }
    // initialize the user in local storage
    getUserInfo()
      .then((userOrUndefined) => setStore("user", userOrUndefined))
      // set user to undefined if an error occurs
      .catch(() => setStore("user", undefined));

    // listen for changes in other windows
    window.addEventListener("storage", onStorageSetByOtherWindow);
  });

  onCleanup(() => {
    // remove listener
    window.removeEventListener("storage", onStorageSetByOtherWindow);
  });

  /** changed in another window should be reflected. thus listen for changes  */
  const onStorageSetByOtherWindow = (event: StorageEvent) => {
    if (event.key !== LOCAL_STORAGE_KEY) {
      return console.warn(
        `unknown localStorage key "${event.key}" was changed by another tab.`
      );
    } else if (event.newValue === null) {
      return console.error(
        `localStorage key "${LOCAL_STORAGE_KEY}" was deleted by another tab. this should not happen.`
      );
    }
    // setting the origin store to not trigger a loop
    // using reconcile to ensure that the store is updated
    // even though json.parse and json.stringify are used.
    // read more here https://github.com/solidjs/solid/issues/1407#issuecomment-1344186955
    setOriginStore(reconcile(JSON.parse(event.newValue)));
  };

  return (
    <LocalStorageContext.Provider value={[store, setStore]}>
      {props.children}
    </LocalStorageContext.Provider>
  );
}
