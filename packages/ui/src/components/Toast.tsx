import { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextType {
  show: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  show: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: '#DCFCE7', text: '#166534', icon: '#16A34A' },
  error: { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' },
  warning: { bg: '#FEF9C3', text: '#854D0E', icon: '#CA8A04' },
  info: { bg: '#DBEAFE', text: '#1E40AF', icon: '#2563EB' },
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning: 'M12 9v4M12 17h.01',
  info: 'M12 16v-4M12 8h.01',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 150, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, toast.duration);

    return () => clearTimeout(timer);
  }, []);

  const colors = TOAST_COLORS[toast.type];
  const iconPath = TOAST_ICONS[toast.type];

  return (
    <Animated.View style={[styles.toast, { backgroundColor: colors.bg, opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastIcon}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d={iconPath} stroke={colors.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={[styles.toastText, { color: colors.text }]} numberOfLines={2}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  let counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${++counter.current}`;
    setToasts(prev => [...prev.slice(-2), { id, type, message, duration }]);
  }, []);

  const success = useCallback((msg: string) => show('success', msg), [show]);
  const error = useCallback((msg: string) => show('error', msg, 4000), [show]);
  const warning = useCallback((msg: string) => show('warning', msg, 4000), [show]);
  const info = useCallback((msg: string) => show('info', msg), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      {toasts.length > 0 && (
        <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  toastIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});
