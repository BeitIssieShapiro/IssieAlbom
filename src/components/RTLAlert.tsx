import React from 'react';
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
            <Text style={styles.title}>
              {title}
            </Text>
          )}
          {message && (
            <View style={{width:"100%"}}>
              <Text
                style={[styles.message]}
              >
                {message}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    buttons.length === 1 && styles.buttonSingle,
                    isCancel && styles.buttonCancel,
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
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

// Static methods to match React Native Alert API
let currentAlert: {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
} | null = null;

let alertCallback: ((alert: typeof currentAlert) => void) | null = null;

export const RTLAlertStatic = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ) => {
    currentAlert = {
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
      onDismiss: () => {
        if (currentAlert) {
          currentAlert.visible = false;
          if (alertCallback) {
            alertCallback({ ...currentAlert });
          }
        }
      },
    };

    if (alertCallback) {
      alertCallback({ ...currentAlert });
    }
  },

  setAlertCallback: (callback: (alert: typeof currentAlert) => void) => {
    alertCallback = callback;
  },
};

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
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
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
