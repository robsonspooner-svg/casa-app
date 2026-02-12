// Document Viewer Screen — Tenant App
// Renders document HTML content with signature & export support

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useDocument } from '@casa/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  pending_owner_signature: { label: 'Awaiting Owner Signature', color: THEME.colors.info, bg: THEME.colors.infoBg },
  pending_tenant_signature: { label: 'Your Signature Required', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  signed: { label: 'Signed', color: THEME.colors.success, bg: THEME.colors.successBg },
  submitted: { label: 'Submitted', color: THEME.colors.success, bg: THEME.colors.successBg },
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

export default function TenantDocumentViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { document: doc, savedSignature, loading, signing, error, signDocument, refreshDocument } = useDocument(id);
  const [exporting, setExporting] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const statusConfig = doc ? STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft : STATUS_CONFIG.draft;

  const handleExportPDF = useCallback(async () => {
    if (!doc) return;
    setExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: doc.html_content });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${doc.title}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancel')) return;
      Alert.alert('Export Error', err instanceof Error ? err.message : 'Failed to export PDF.');
    } finally {
      setExporting(false);
    }
  }, [doc]);

  const handleSign = useCallback(async (signatureImage: string, save: boolean) => {
    const success = await signDocument(signatureImage, save);
    if (success) {
      setShowSignaturePad(false);
      Alert.alert('Document Signed', 'Your signature has been recorded.');
    }
  }, [signDocument]);

  const needsTenantSignature = doc?.status === 'pending_tenant_signature';
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
        <TouchableOpacity
          onPress={handleExportPDF}
          style={styles.shareButton}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={THEME.colors.brand} />
          ) : (
            <ShareIcon />
          )}
        </TouchableOpacity>
      </View>

      {/* Status bar */}
      <View style={[styles.statusBar, { backgroundColor: statusConfig.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        <Text style={styles.statusDate}>{formatDate(doc.created_at)}</Text>
      </View>

      {/* Document body (WebView) */}
      <View style={styles.webViewContainer}>
        <WebView
          source={{ html: wrapHTMLForViewer(doc.html_content) }}
          style={styles.webView}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
          originWhitelist={['*']}
          scalesPageToFit={false}
        />
      </View>

      {/* Signatures section */}
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
        {needsTenantSignature && (
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

        {doc.status === 'pending_owner_signature' && (
          <View style={styles.statusFooter}>
            <Text style={styles.statusFooterText}>Awaiting owner signature</Text>
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

function wrapHTMLForViewer(html: string): string {
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
  shareButton: {
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
  statusDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  webView: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
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
