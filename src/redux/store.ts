import {configureStore} from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import {thunkRejectionMiddleware} from './thunkRejectionMiddleware';

// Persistence lives outside Redux (S4, v2.7.1 removed redux-persist, which
// ran with an empty whitelist and only delayed the first render):
// - Sync MMKV via StorageService: isOnboarded, weekStartDay, locale and swipe
//   preferences — read synchronously when needed
// - ThemeContext + MMKV: theme preference
// - WatermelonDB: all domain data (expenses, categories, etc.) — source of truth
// monthSelection is deliberately NOT persisted: its initial state is the
// device's current month, so every cold start opens on today's month.
const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(thunkRejectionMiddleware),
  enhancers: getDefaultEnhancers =>
    getDefaultEnhancers({
      autoBatch: {type: 'tick'},
    }),
});

export type AppDispatch = typeof store.dispatch;

export default store;
