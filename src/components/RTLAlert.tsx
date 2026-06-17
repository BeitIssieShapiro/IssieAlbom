import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MODAL_ORIENTATIONS } from '../types/Album';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface RTLAlertProps {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

export function RTLAlert({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onDismiss,
}: RTLAlertProps) {
  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.alertContainer,
        ]}>
          {title && (
            <Text allowFontScaling={false} style={styles.title}>
              {title}
            </Text>
          )}
          {message && (
            <View style={{width:"100%"}}>
              <Text
                allowFontScaling={false}
                style={[styles.message]}
              >
                {message}
              </Text>
            </View>
          )}

          <View style={[styles.buttonContainer, buttons.length >= 3 && styles.buttonContainerVertical]}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    buttons.length === 1 && styles.buttonSingle,
                    buttons.length >= 3 && styles.buttonFull,
                    isCancel && styles.buttonCancel,
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- Static alert API (drop-in replacement for Alert.alert) ---

type AlertConfig = {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
};

let alertListener: ((config: AlertConfig) => void) | null = null;

export const RTLAlertStatic = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ) => {
    const config: AlertConfig = {
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
    };
    if (alertListener) {
      alertListener(config);
    }
  },
};

/**
 * Mount once in App.tsx to enable RTLAlertStatic.alert() globally.
 * Usage: <GlobalRTLAlert />
 */
export function GlobalRTLAlert() {
  const [config, setConfig] = useState<AlertConfig>({ visible: false });

  useEffect(() => {
    alertListener = setConfig;
    return () => { alertListener = null; };
  }, []);

  return (
    <RTLAlert
      visible={config.visible}
      title={config.title}
      message={config.message}
      buttons={config.buttons}
      onDismiss={() => setConfig({ visible: false })}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    minWidth: 270,
    maxWidth: 340,
    padding: 20,
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
  },
  
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  message: {
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'left',
    maxWidth: '100%',
  },
  
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  buttonFull: {
    width: '100%',
    paddingHorizontal: 16,
  },
  buttonSingle: {
    backgroundColor: '#007AFF',
  },
  buttonCancel: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  buttonTextCancel: {
    color: '#fff',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
  },
});
