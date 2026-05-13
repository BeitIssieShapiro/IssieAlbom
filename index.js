/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { GlobalContext } from './src/contexts/GlobalContext';
import { initIssieSharedLang } from './src/issie-shared-lang';
import { initializeFirebase } from './src/firebase-config';

initIssieSharedLang();
initializeFirebase();

function AppContainer(props) {
  const now = new Date();
  return (
    <GlobalContext.Provider
      value={{
        nativeStartTime: props.nativeStartTime ?? now.getTime(),
      }}>
      <App />
    </GlobalContext.Provider>
  );
}

AppRegistry.registerComponent(appName, () => AppContainer);
