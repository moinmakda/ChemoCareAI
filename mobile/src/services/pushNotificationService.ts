/**
 * Push Notification Service
 * 
 * Handles Expo push notifications, token registration,
 * and notification preferences.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Types
export interface PushNotificationToken {
  token: string;
  type: 'expo';
}

export interface NotificationData {
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Notification channel for Android
async function createNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ChemoCare Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });

    // Treatment reminders channel
    await Notifications.setNotificationChannelAsync('treatment', {
      name: 'Treatment Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    });

    // Approval notifications channel
    await Notifications.setNotificationChannelAsync('approvals', {
      name: 'Approval Requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dc2626',
    });
  }
}

/**
 * Request push notification permissions
 */
export const requestPermissions = async (): Promise<boolean> => {
  if (!Device.isDevice) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Create notification channels for Android
  await createNotificationChannel();

  return true;
};

/**
 * Get the Expo push token
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return token;
  } catch {
    return null;
  }
};

/**
 * Register push token with the backend
 */
export const registerPushToken = async (): Promise<boolean> => {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;

    await apiClient.put('/auth/push-token', {
      push_token: token,
    });

    return true;
  } catch {
    return false;
  }
};

/**
 * Unregister push token (on logout)
 */
export const unregisterPushToken = async (): Promise<void> => {
  try {
    await apiClient.delete('/auth/push-token');
  } catch {
    // silent
  }
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, any>
): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });
};

/**
 * Schedule a treatment reminder
 */
export const scheduleTreatmentReminder = async (
  treatmentId: string,
  treatmentName: string,
  treatmentTime: Date,
  hoursBeforeArray: number[] = [24, 2]
): Promise<string[]> => {
  const notificationIds: string[] = [];

  for (const hoursBefore of hoursBeforeArray) {
    const reminderTime = new Date(treatmentTime.getTime() - hoursBefore * 60 * 60 * 1000);
    
    // Don't schedule if in the past
    if (reminderTime <= new Date()) continue;

    const timeText = hoursBefore >= 24 
      ? `${Math.floor(hoursBefore / 24)} day(s)` 
      : `${hoursBefore} hour(s)`;

    const id = await scheduleLocalNotification(
      'Treatment Reminder',
      `Your ${treatmentName} treatment is in ${timeText}`,
      { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
      {
        type: 'treatment_reminder',
        treatmentId,
      }
    );

    notificationIds.push(id);
  }

  return notificationIds;
};

/**
 * Cancel a scheduled notification
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  return Notifications.getAllScheduledNotificationsAsync();
};

/**
 * Set up notification response handler
 */
export const setupNotificationHandler = (
  handler: (notification: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(handler);
};

/**
 * Set up notification received handler (when app is open)
 */
export const setupNotificationReceivedHandler = (
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(handler);
};

/**
 * Get the badge count
 */
export const getBadgeCount = async (): Promise<number> => {
  return Notifications.getBadgeCountAsync();
};

/**
 * Set the badge count
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

/**
 * Clear all notifications from notification center
 */
export const clearAllNotifications = async (): Promise<void> => {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
};
