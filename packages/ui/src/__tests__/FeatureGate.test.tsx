// Integration tests for FeatureGate and UpgradePrompt components
// Mission 02 Phase F: Subscription Tier UI

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Text } from 'react-native';
import { FeatureGate, UpgradePrompt } from '../components/FeatureGate';

// Mock react-native using the outer React reference to avoid version mismatch
vi.mock('react-native', () => ({
  View: React.forwardRef(({ children, style, ...props }: any, ref: any) =>
    React.createElement('div', { style, ref, ...props }, children)
  ),
  Text: React.forwardRef(({ children, style, ...props }: any, ref: any) =>
    React.createElement('span', { style, ref, ...props }, children)
  ),
  StyleSheet: {
    create: (styles: any) => styles,
  },
  TouchableOpacity: React.forwardRef(({ children, onPress, ...props }: any, ref: any) =>
    React.createElement('button', { onClick: onPress, ref, ...props }, children)
  ),
}));

// Mock react-native-svg
vi.mock('react-native-svg', () => ({
  default: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('svg', { ref, ...props }, children)
  ),
  Path: React.forwardRef((props: any, ref: any) =>
    React.createElement('path', { ref, ...props })
  ),
}));

describe('FeatureGate', () => {
  it('renders children when user has access', () => {
    const { getByText } = render(
      <FeatureGate
        hasAccess={true}
        requiredTier={null}
        featureName="Tenant Finding"
      >
        <Text>Protected Content</Text>
      </FeatureGate>
    );
    expect(getByText('Protected Content')).toBeTruthy();
  });

  it('renders UpgradePrompt when user lacks access', () => {
    const { getByText, queryByText } = render(
      <FeatureGate
        hasAccess={false}
        requiredTier="pro"
        featureName="Tenant Finding"
        featureDescription="Find quality tenants fast"
      >
        <Text>Protected Content</Text>
      </FeatureGate>
    );
    expect(queryByText('Protected Content')).toBeNull();
    expect(getByText('Tenant Finding')).toBeTruthy();
    expect(getByText('Find quality tenants fast')).toBeTruthy();
    expect(getByText('Upgrade to Pro')).toBeTruthy();
  });

  it('renders lock icon when access is denied', () => {
    const { container } = render(
      <FeatureGate
        hasAccess={false}
        requiredTier="hands_off"
        featureName="Professional Inspections"
      >
        <Text>Content</Text>
      </FeatureGate>
    );
    // The lock icon is now an SVG element
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('calls onUpgrade when upgrade button is pressed', () => {
    const mockOnUpgrade = vi.fn();
    const { getByText } = render(
      <FeatureGate
        hasAccess={false}
        requiredTier="pro"
        featureName="Feature"
        onUpgrade={mockOnUpgrade}
      >
        <Text>Content</Text>
      </FeatureGate>
    );
    const button = getByText('Upgrade to Pro');
    button.click();
    expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
  });
});

describe('UpgradePrompt', () => {
  it('shows correct tier name for starter upgrade', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="starter"
        featureName="Basic Feature"
      />
    );
    expect(getByText('Upgrade to Starter')).toBeTruthy();
  });

  it('shows correct tier name for pro upgrade', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="pro"
        featureName="Pro Feature"
      />
    );
    expect(getByText('Upgrade to Pro')).toBeTruthy();
  });

  it('shows correct tier name for hands_off upgrade', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="hands_off"
        featureName="Premium Feature"
      />
    );
    expect(getByText('Upgrade to Hands-Off')).toBeTruthy();
  });

  it('shows feature name as title', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="pro"
        featureName="Advanced Analytics"
      />
    );
    expect(getByText('Advanced Analytics')).toBeTruthy();
  });

  it('shows optional description', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="pro"
        featureName="Feature"
        featureDescription="This feature helps you do X"
      />
    );
    expect(getByText('This feature helps you do X')).toBeTruthy();
  });

  it('renders compact variant with inline text', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier="pro"
        featureName="Tenant Finding"
        compact={true}
      />
    );
    expect(getByText('Upgrade to Pro for Tenant Finding')).toBeTruthy();
  });

  it('handles null requiredTier gracefully', () => {
    const { getByText } = render(
      <UpgradePrompt
        requiredTier={null}
        featureName="Feature"
      />
    );
    expect(getByText('Upgrade to a higher')).toBeTruthy();
  });
});
