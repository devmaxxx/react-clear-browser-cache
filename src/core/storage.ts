import engine from 'store/src/store-engine';
import cookieStorage from 'store/storages/cookieStorage';
import localStorage from 'store/storages/localStorage';
import memoryStorage from 'store/storages/memoryStorage';

export const storage = engine.createStore([
  cookieStorage,
  localStorage,
  memoryStorage
]);
