// Signature Pad Component — Bottom sheet with canvas for drawing signatures
// Supports saving signatures for reuse across documents

import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import type { SavedSignatureRow } from '@casa/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD_HEIGHT = SCREEN_HEIGHT * 0.5;
const CANVAS_HEIGHT = PAD_HEIGHT - 200; // Space for buttons and header

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureImage: string, saveSignature: boolean) => Promise<void>;
  savedSignature: SavedSignatureRow | null;
  signing: boolean;
}

function CloseIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={THEME.colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const SIGNATURE_CANVAS_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #fff; touch-action: none; }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
      touch-action: none;
    }
    .sign-line {
      position: absolute;
      bottom: 40px;
      left: 20px;
      right: 20px;
      height: 1px;
      background: #E5E5E5;
      pointer-events: none;
    }
    .placeholder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #A3A3A3;
      font-family: -apple-system, sans-serif;
      font-size: 15px;
      pointer-events: none;
      transition: opacity 0.2s;
    }
  </style>
</head>
<body>
  <canvas id="sigCanvas"></canvas>
  <div class="sign-line"></div>
  <div class="placeholder" id="placeholder">Draw your signature here</div>
  <script>
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');
    let isDrawing = false;
    let hasDrawn = false;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0A0A0A';
    }
    resize();
    window.addEventListener('resize', resize);

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      placeholder.style.opacity = '0';
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      isDrawing = false;
    }, { passive: false });

    // Mouse support for testing
    canvas.addEventListener('mousedown', function(e) {
      isDrawing = true;
      hasDrawn = true;
      placeholder.style.opacity = '0';
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    canvas.addEventListener('mouseup', function() { isDrawing = false; });

    window.clearCanvas = function() {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      hasDrawn = false;
      placeholder.style.opacity = '1';
    };

    window.getSignature = function() {
      if (!hasDrawn) return '';
      return canvas.toDataURL('image/png');
    };
  </script>
</body>
</html>`;

export default function SignaturePad({ visible, onClose, onSign, savedSignature, signing }: SignaturePadProps) {
  const webViewRef = useRef<WebView>(null);
  const [useSaved, setUseSaved] = useState(false);

  const handleClear = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.clearCanvas(); true;');
    setUseSaved(false);
  }, []);

  const handleSignWithSave = useCallback(async () => {
    if (useSaved && savedSignature) {
      await onSign(savedSignature.signature_image, false);
      return;
    }

    webViewRef.current?.injectJavaScript(`
      const sig = window.getSignature();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sign', save: true, data: sig }));
      true;
    `);
  }, [useSaved, savedSignature, onSign]);

  const handleSignOnly = useCallback(async () => {
    if (useSaved && savedSignature) {
      await onSign(savedSignature.signature_image, false);
      return;
    }

    webViewRef.current?.injectJavaScript(`
      const sig = window.getSignature();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sign', save: false, data: sig }));
      true;
    `);
  }, [useSaved, savedSignature, onSign]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'sign' && msg.data) {
        onSign(msg.data, msg.save);
      }
    } catch {
      // Ignore parse errors
    }
  }, [onSign]);

  const handleUseSaved = useCallback(() => {
    setUseSaved(true);
  }, []);

  const handleDrawNew = useCallback(() => {
    setUseSaved(false);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} onPress={onClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sign Document</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          {/* Saved signature option */}
          {savedSignature && !useSaved && (
            <View style={styles.savedSection}>
              <Text style={styles.savedLabel}>Saved Signature</Text>
              <TouchableOpacity style={styles.savedCard} onPress={handleUseSaved}>
                <Image
                  source={{ uri: savedSignature.signature_image }}
                  style={styles.savedImage}
                  resizeMode="contain"
                />
                <Text style={styles.savedAction}>Use Saved Signature</Text>
              </TouchableOpacity>
              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or draw a new one below</Text>
                <View style={styles.orLine} />
              </View>
            </View>
          )}

          {/* Using saved signature view */}
          {useSaved && savedSignature && (
            <View style={styles.savedActiveSection}>
              <Image
                source={{ uri: savedSignature.signature_image }}
                style={styles.savedActiveImage}
                resizeMode="contain"
              />
              <TouchableOpacity onPress={handleDrawNew}>
                <Text style={styles.drawNewText}>Draw a new signature instead</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Signature canvas */}
          {!useSaved && (
            <View style={[styles.canvasContainer, { height: Math.max(CANVAS_HEIGHT, 160) }]}>
              <WebView
                ref={webViewRef}
                source={{ html: SIGNATURE_CANVAS_HTML }}
                style={styles.canvas}
                scrollEnabled={false}
                bounces={false}
                onMessage={handleMessage}
                javaScriptEnabled
                originWhitelist={['*']}
              />
              <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.saveSignButton}
              onPress={handleSignWithSave}
              disabled={signing}
              activeOpacity={0.8}
            >
              {signing ? (
                <ActivityIndicator size="small" color={THEME.colors.textInverse} />
              ) : (
                <Text style={styles.saveSignButtonText}>
                  {useSaved ? 'Sign Document' : 'Save Signature & Sign'}
                </Text>
              )}
            </TouchableOpacity>

            {!useSaved && (
              <TouchableOpacity
                style={styles.signOnlyButton}
                onPress={handleSignOnly}
                disabled={signing}
                activeOpacity={0.8}
              >
                <Text style={styles.signOnlyButtonText}>Sign Document</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: PAD_HEIGHT + 60,
    paddingBottom: 34, // Safe area
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  savedLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  savedCard: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12,
    alignItems: 'center',
  },
  savedImage: {
    width: SCREEN_WIDTH - 80,
    height: 60,
  },
  savedAction: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.brand,
    marginTop: 8,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  orText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    paddingHorizontal: 12,
  },
  savedActiveSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  savedActiveImage: {
    width: SCREEN_WIDTH - 80,
    height: 100,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.canvas,
  },
  drawNewText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.brand,
    marginTop: 12,
  },
  canvasContainer: {
    marginHorizontal: 20,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#fff',
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  clearText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  saveSignButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveSignButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  signOnlyButton: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
  },
  signOnlyButtonText: {
    color: THEME.colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
});
