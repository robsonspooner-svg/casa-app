// Room Layout Sketch — WebView-based drawing canvas for room floor plan sketches
// Allows owner to draw a rough room layout (walls, door, windows) during inspection

import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RoomLayoutSketchProps {
  visible: boolean;
  onClose: () => void;
  onSave: (imageData: string, pathData: string) => Promise<void>;
  saving: boolean;
  existingPathData?: string | null;
}

const SKETCH_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #FAFAFA; touch-action: none; }
    canvas { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
    .grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.15; }
    .placeholder {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #A3A3A3; font-family: -apple-system, sans-serif; font-size: 14px;
      pointer-events: none; transition: opacity 0.2s; text-align: center; line-height: 1.5;
    }
    .toolbar {
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; background: rgba(255,255,255,0.95); border-radius: 24px;
      padding: 6px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); pointer-events: auto;
    }
    .tool-btn {
      width: 36px; height: 36px; border-radius: 18px; display: flex;
      align-items: center; justify-content: center; border: 2px solid transparent;
      cursor: pointer; font-size: 16px; background: transparent;
    }
    .tool-btn.active { border-color: #1B1464; background: #EDE9FE; }
    .color-indicator { width: 8px; height: 8px; border-radius: 4px; margin-top: 2px; }
  </style>
</head>
<body>
  <canvas id="sketchCanvas"></canvas>
  <div class="placeholder" id="placeholder">Draw your room layout here<br>Walls, doors, windows &amp; features</div>
  <div class="toolbar">
    <button class="tool-btn active" id="wallBtn" onclick="setTool('wall')" title="Wall">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="1" stroke="#0A0A0A" stroke-width="2.5"/></svg>
    </button>
    <button class="tool-btn" id="doorBtn" onclick="setTool('door')" title="Door">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 21V3h10l4 4v14H5z" stroke="#2563EB" stroke-width="2"/></svg>
    </button>
    <button class="tool-btn" id="windowBtn" onclick="setTool('window')" title="Window">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="1" stroke="#059669" stroke-width="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="#059669" stroke-width="1.5"/><line x1="4" y1="12" x2="20" y2="12" stroke="#059669" stroke-width="1.5"/></svg>
    </button>
    <button class="tool-btn" id="labelBtn" onclick="setTool('label')" title="Label">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7V4h16v3M9 20h6M12 4v16" stroke="#525252" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <button class="tool-btn" id="undoBtn" onclick="undo()" title="Undo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 10h10a5 5 0 010 10H9M3 10l4-4M3 10l4 4" stroke="#525252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>

  <script>
    const canvas = document.getElementById('sketchCanvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');

    let isDrawing = false;
    let hasDrawn = false;
    let currentTool = 'wall';
    let strokes = []; // Array of { tool, points, color, width }
    let currentStroke = null;

    const TOOL_STYLES = {
      wall:   { color: '#0A0A0A', width: 4 },
      door:   { color: '#2563EB', width: 3 },
      window: { color: '#059669', width: 3 },
      label:  { color: '#525252', width: 2 },
    };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
      redraw();
    }
    resize();
    window.addEventListener('resize', resize);

    function setTool(tool) {
      currentTool = tool;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById(tool + 'Btn');
      if (btn) btn.classList.add('active');
    }

    function redraw() {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // Draw grid
      ctx.strokeStyle = '#E5E5E5';
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      for (let x = 0; x < canvas.width / dpr; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / dpr); ctx.stroke();
      }
      for (let y = 0; y < canvas.height / dpr; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / dpr, y); ctx.stroke();
      }

      // Draw all strokes
      for (const stroke of strokes) {
        drawStroke(stroke);
      }
      if (currentStroke) {
        drawStroke(currentStroke);
      }
    }

    function drawStroke(stroke) {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'door') {
        // Dashed line for doors
        ctx.setLineDash([6, 4]);
      } else if (stroke.tool === 'window') {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

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
      const style = TOOL_STYLES[currentTool] || TOOL_STYLES.wall;
      currentStroke = { tool: currentTool, points: [p], color: style.color, width: style.width };
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing || !currentStroke) return;
      const p = getPos(e);
      currentStroke.points.push(p);
      redraw();
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      if (currentStroke && currentStroke.points.length > 1) {
        strokes.push(currentStroke);
      }
      currentStroke = null;
      isDrawing = false;
      redraw();
    }, { passive: false });

    // Mouse support
    canvas.addEventListener('mousedown', function(e) {
      isDrawing = true;
      hasDrawn = true;
      placeholder.style.opacity = '0';
      const p = getPos(e);
      const style = TOOL_STYLES[currentTool] || TOOL_STYLES.wall;
      currentStroke = { tool: currentTool, points: [p], color: style.color, width: style.width };
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing || !currentStroke) return;
      currentStroke.points.push(getPos(e));
      redraw();
    });
    canvas.addEventListener('mouseup', function() {
      if (currentStroke && currentStroke.points.length > 1) strokes.push(currentStroke);
      currentStroke = null;
      isDrawing = false;
      redraw();
    });

    function undo() {
      strokes.pop();
      if (strokes.length === 0) {
        hasDrawn = false;
        placeholder.style.opacity = '1';
      }
      redraw();
    }

    window.clearSketch = function() {
      strokes = [];
      currentStroke = null;
      hasDrawn = false;
      placeholder.style.opacity = '1';
      redraw();
    };

    window.getSketchData = function() {
      if (!hasDrawn) return JSON.stringify({ image: '', paths: [] });
      const image = canvas.toDataURL('image/png');
      return JSON.stringify({ image: image, paths: strokes });
    };

    window.loadPathData = function(data) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (Array.isArray(parsed)) {
          strokes = parsed;
          hasDrawn = strokes.length > 0;
          if (hasDrawn) placeholder.style.opacity = '0';
          redraw();
        }
      } catch(e) {}
    };
  </script>
</body>
</html>`;

// Stable source object to prevent WebView remounting on re-render
const WEBVIEW_SOURCE = { html: SKETCH_HTML };

function RoomLayoutSketch({
  visible,
  onClose,
  onSave,
  saving,
  existingPathData,
}: RoomLayoutSketchProps) {
  const webViewRef = useRef<WebView>(null);

  const handleClear = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.clearSketch(); true;');
  }, []);

  const handleSave = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      const data = window.getSketchData();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'save', data: data }));
      true;
    `);
  }, []);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'save' && msg.data) {
        const sketchData = JSON.parse(msg.data);
        if (sketchData.image) {
          onSave(sketchData.image, JSON.stringify(sketchData.paths));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [onSave]);

  const handleWebViewLoad = useCallback(() => {
    if (existingPathData) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(existingPathData);
      } catch {
        return; // Invalid JSON, skip loading
      }
      const safeJson = JSON.stringify(parsed);
      webViewRef.current?.injectJavaScript(`window.loadPathData(${safeJson}); true;`);
    }
  }, [existingPathData]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 6L6 18M6 6l12 12"
                stroke={THEME.colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room Layout</Text>
          <TouchableOpacity onPress={handleClear} style={styles.headerButton}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Draw the room outline showing walls, doors, and windows. Use the toolbar to switch tools.
          </Text>
        </View>

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <WebView
            ref={webViewRef}
            source={WEBVIEW_SOURCE}
            style={styles.canvas}
            scrollEnabled={false}
            bounces={false}
            onMessage={handleMessage}
            onLoad={handleWebViewLoad}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        </View>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={THEME.colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonText}>Save Layout</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(RoomLayoutSketch);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  clearText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.error,
  },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.colors.infoBg,
  },
  hintText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.info,
    textAlign: 'center',
  },
  canvasContainer: {
    flex: 1,
    margin: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 34,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  saveButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
