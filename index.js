/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { GlobalContext } from './src/contexts/GlobalContext';

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
