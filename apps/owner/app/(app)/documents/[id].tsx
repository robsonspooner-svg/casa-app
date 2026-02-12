// Document Viewer Screen — Owner App
// Renders document HTML content, PDF files, and images with signature & export support

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useDocument } from '@casa/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import SignaturePad from '../../../components/SignaturePad';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DownloadIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 11.08V12a10 10 0 11-5.93-9.14"
        stroke={THEME.colors.success}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 4L12 14.01l-3-3"
        stroke={THEME.colors.success}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PenIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke={THEME.colors.textInverse}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: THEME.colors.textSecondary, bg: THEME.colors.canvas },
  pending_owner_signature: { label: 'Awaiting Your Signature', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  pending_tenant_signature: { label: 'Sent to Tenant', color: THEME.colors.info, bg: THEME.colors.infoBg },
  signed: { label: 'Signed', color: THEME.colors.success, bg: THEME.colors.successBg },
  archived: { label: 'Archived', color: THEME.colors.textTertiary, bg: THEME.colors.canvas },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Determine document render type from MIME type or file extension */
function getDocumentRenderType(doc: { mime_type?: string | null; file_url?: string | null; html_content?: string | null; storage_path?: string | null }): 'html' | 'pdf' | 'image' | 'unknown' {
  const mime = (doc.mime_type || '').toLowerCase();
  const path = (doc.file_url || doc.storage_path || '').toLowerCase();

  if (doc.html_content) return 'html';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i.test(path)) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(path)) return 'pdf';
  if (mime.startsWith('text/html')) return 'html';
  return 'unknown';
}

/** Format file size for display */
function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { document: doc, savedSignature, loading, signing, error, signDocument, refreshDocument } = useDocument(id);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [imageError, setImageError] = useState(false);

  const statusConfig = doc ? STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft : STATUS_CONFIG.draft;

  const handleExportPDF = useCallback(async () => {
    if (!doc) return;
    setExporting(true);
    try {
      if (doc.html_content) {
        const { uri } = await Print.printToFileAsync({ html: doc.html_content });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${doc.title}`,
          UTI: 'com.adobe.pdf',
        });
      } else if (doc.file_url) {
        await Sharing.shareAsync(doc.file_url, {
          dialogTitle: `Share ${doc.title}`,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancel')) return;
      Alert.alert('Export Error', err instanceof Error ? err.message : 'Failed to export.');
    } finally {
      setExporting(false);
    }
  }, [doc]);

  const handleDownload = useCallback(async () => {
    if (!doc?.file_url) return;
    setDownloading(true);
    try {
      const fileName = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = doc.file_url.split('.').pop()?.split('?')[0] || 'pdf';
      const destFile = new ExpoFile(Paths.cache, `${fileName}.${ext}`);
      const response = await fetch(doc.file_url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      destFile.write(new Uint8Array(arrayBuffer));
      await Sharing.shareAsync(destFile.uri, { dialogTitle: `Save ${doc.title}` });
    } catch (err) {
      Alert.alert('Download Error', err instanceof Error ? err.message : 'Failed to download file.');
    } finally {
      setDownloading(false);
    }
  }, [doc]);

  const handleSign = useCallback(async (signatureImage: string, save: boolean) => {
    const success = await signDocument(signatureImage, save);
    if (success) {
      setShowSignaturePad(false);
      Alert.alert('Document Signed', 'Your signature has been recorded.');
    }
  }, [signDocument]);

  // Determine if current user needs to sign
  const needsOwnerSignature = doc?.status === 'pending_owner_signature' || (doc?.requires_signature && doc?.status === 'draft');
  const isSigned = doc?.status === 'signed';

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      </View>
    );
  }

  if (error || !doc) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Document not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderType = getDocumentRenderType(doc);
  const fileUrl = doc.file_url || '';
  const hasDownloadableFile = !!doc.file_url;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
        <View style={styles.headerActions}>
          {hasDownloadableFile && (
            <TouchableOpacity
              onPress={handleDownload}
              style={styles.headerActionButton}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={THEME.colors.brand} />
              ) : (
                <DownloadIcon />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleExportPDF}
            style={styles.headerActionButton}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={THEME.colors.brand} />
            ) : (
              <ShareIcon />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Status bar */}
      <View style={[styles.statusBar, { backgroundColor: statusConfig.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        {doc.mime_type && (
          <Text style={styles.mimeType}>{doc.mime_type.split('/').pop()?.toUpperCase()}</Text>
        )}
        <Text style={styles.statusDate}>{formatDate(doc.created_at)}</Text>
      </View>

      {/* Document body — renders based on type */}
      <View style={styles.contentContainer}>
        {renderType === 'html' && doc.html_content && (
          <WebView
            source={{ html: wrapHTMLForViewer(doc.html_content) }}
            style={styles.webView}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            originWhitelist={['*']}
            scalesPageToFit={false}
          />
        )}

        {renderType === 'pdf' && (
          <WebView
            source={{
              uri: Platform.OS === 'ios'
                ? fileUrl
                : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`,
            }}
            style={styles.webView}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.pdfLoadingOverlay}>
                <ActivityIndicator size="large" color={THEME.colors.brand} />
                <Text style={styles.loadingText}>Loading PDF...</Text>
              </View>
            )}
            onError={() => {
              Alert.alert('PDF Error', 'Unable to display PDF. Try downloading the file instead.');
            }}
          />
        )}

        {renderType === 'image' && (
          <ScrollView
            style={styles.imageScrollView}
            contentContainerStyle={styles.imageScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom={true}
            showsVerticalScrollIndicator={false}
          >
            {!imageError ? (
              <Image
                source={{ uri: fileUrl }}
                style={styles.imageViewer}
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.imageErrorContainer}>
                <Text style={styles.imageErrorText}>Unable to load image</Text>
                <TouchableOpacity onPress={handleDownload} style={styles.downloadFallbackButton}>
                  <DownloadIcon />
                  <Text style={styles.downloadFallbackText}>Download instead</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {renderType === 'unknown' && (
          <View style={styles.unknownContainer}>
            <Text style={styles.unknownTitle}>Preview unavailable</Text>
            <Text style={styles.unknownText}>
              This file type ({doc.mime_type || 'unknown'}) cannot be previewed in-app.
            </Text>
            {hasDownloadableFile && (
              <TouchableOpacity
                onPress={handleDownload}
                style={styles.downloadButton}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={THEME.colors.textInverse} />
                ) : (
                  <>
                    <DownloadIcon />
                    <Text style={styles.downloadButtonText}>Download File</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Signatures section (if any exist) */}
      {doc.signatures.length > 0 && (
        <View style={styles.signaturesSection}>
          {doc.signatures.map((sig) => (
            <View key={sig.id} style={styles.signatureRow}>
              <Image
                source={{ uri: sig.signature_image }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
              <View style={styles.signatureInfo}>
                <Text style={styles.signatureName}>{sig.signer_name}</Text>
                <Text style={styles.signatureDate}>
                  Signed {formatDateTime(sig.signed_at)}
                </Text>
              </View>
              <CheckCircleIcon />
            </View>
          ))}
        </View>
      )}

      {/* Footer action */}
      <View style={styles.footer}>
        {needsOwnerSignature && (
          <TouchableOpacity
            style={styles.signButton}
            onPress={() => setShowSignaturePad(true)}
            disabled={signing}
            activeOpacity={0.8}
          >
            {signing ? (
              <ActivityIndicator size="small" color={THEME.colors.textInverse} />
            ) : (
              <>
                <PenIcon />
                <Text style={styles.signButtonText}>Sign Document</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {doc.status === 'pending_tenant_signature' && (
          <View style={styles.statusFooter}>
            <Text style={styles.statusFooterText}>Awaiting tenant signature</Text>
          </View>
        )}

        {isSigned && (
          <View style={[styles.statusFooter, { backgroundColor: THEME.colors.successBg }]}>
            <CheckCircleIcon />
            <Text style={[styles.statusFooterText, { color: THEME.colors.success, marginLeft: 8 }]}>
              Document fully signed
            </Text>
          </View>
        )}

        {!doc.requires_signature && doc.status === 'draft' && (
          <TouchableOpacity
            style={styles.signButton}
            onPress={handleExportPDF}
            disabled={exporting}
            activeOpacity={0.8}
          >
            <Text style={styles.signButtonText}>Export PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Signature Pad Modal */}
      <SignaturePad
        visible={showSignaturePad}
        onClose={() => setShowSignaturePad(false)}
        onSign={handleSign}
        savedSignature={savedSignature}
        signing={signing}
      />
    </View>
  );
}

/** Wraps raw HTML content with viewport meta and styling for proper WebView rendering */
function wrapHTMLForViewer(html: string): string {
  // If the HTML already has a full document structure, just inject viewport
  if (html.includes('<html') || html.includes('<!DOCTYPE')) {
    return html.replace(
      '<head>',
      `<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">`,
    );
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #0A0A0A;
      padding: 20px;
      margin: 0;
      background: #fff;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
    h3 { font-size: 16px; font-weight: 600; margin-top: 16px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; border: 1px solid #E5E5E5; text-align: left; font-size: 13px; }
    th { background: #FAFAFA; font-weight: 600; }
    p { margin: 8px 0; }
    .signature-block { margin-top: 32px; padding-top: 16px; border-top: 2px solid #E5E5E5; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  mimeType: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    backgroundColor: THEME.colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
    fontWeight: '500',
  },
  statusDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  webView: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  pdfLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
  },
  imageScrollView: {
    flex: 1,
    backgroundColor: THEME.colors.textPrimary,
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  imageViewer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imageErrorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
    marginBottom: 16,
  },
  downloadFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
  },
  downloadFallbackText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  unknownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  unknownTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  unknownText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
  },
  downloadButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  signaturesSection: {
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  signatureImage: {
    width: 80,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.canvas,
  },
  signatureInfo: {
    flex: 1,
    marginLeft: 12,
  },
  signatureName: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  signatureDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  signButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
  },
  signButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.md,
  },
  statusFooterText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.info,
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  errorButtonText: {
    color: THEME.colors.textInverse,
    fontWeight: '600',
    fontSize: THEME.fontSize.body,
  },
});
