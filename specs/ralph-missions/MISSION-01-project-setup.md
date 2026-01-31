# Mission 01: Project Setup

## Overview
**Goal**: Create the monorepo structure with Expo apps and shared packages
**Depends On**: None (first mission)
**Estimated Effort**: 4 hours

## Success Criteria
- [ ] Monorepo initialized with pnpm workspaces
- [ ] Turborepo configured for build orchestration
- [ ] Owner app (Expo) created with basic navigation
- [ ] Tenant app (Expo) created with basic navigation
- [ ] Shared UI package created with Button and Card components
- [ ] Shared API package created with Supabase client placeholder
- [ ] TypeScript configured across all packages
- [ ] ESLint configured across all packages
- [ ] All packages build successfully
- [ ] Expo apps run in Expo Go

## Technical Approach

### 1. Initialize Monorepo

```bash
# Create root directory structure
mkdir -p apps/owner apps/tenant apps/admin
mkdir -p packages/ui packages/api packages/config
mkdir -p supabase/migrations supabase/functions
mkdir -p specs/ralph-missions docs
```

### 2. Root Configuration Files

**package.json**:
```json
{
  "name": "propbot",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "turbo": "^2.0.0",
    "typescript": "^5.3.3"
  },
  "packageManager": "pnpm@8.15.0"
}
```

**turbo.json**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**tsconfig.json** (root):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "noEmit": true
  },
  "exclude": ["node_modules"]
}
```

### 3. Shared Packages

**packages/config/package.json**:
```json
{
  "name": "@propbot/config",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**packages/config/src/index.ts**:
```typescript
export const APP_NAME = 'PropBot';
export const APP_VERSION = '0.0.1';

export const COLORS = {
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
  success: {
    50: '#F0FDF4',
    500: '#22C55E',
    700: '#15803D',
  },
  warning: {
    50: '#FFFBEB',
    500: '#F59E0B',
    700: '#B45309',
  },
  error: {
    50: '#FEF2F2',
    500: '#EF4444',
    700: '#B91C1C',
  },
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
```

**packages/ui/package.json**:
```json
{
  "name": "@propbot/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@propbot/config": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "react": "^18.2.0",
    "react-native": "^0.73.0",
    "typescript": "^5.3.3"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-native": "^0.73.0"
  }
}
```

**packages/ui/src/Button.tsx**:
```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING } from '@propbot/config';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    disabled && styles.textDisabled,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.primary[600] : '#FFFFFF'} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: COLORS.primary[600],
  },
  secondary: {
    backgroundColor: COLORS.neutral[200],
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary[600],
  },
  size_sm: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  size_md: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  size_lg: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: COLORS.neutral[800],
  },
  text_outline: {
    color: COLORS.primary[600],
  },
  text_sm: {
    fontSize: 14,
  },
  text_md: {
    fontSize: 16,
  },
  text_lg: {
    fontSize: 18,
  },
  textDisabled: {
    color: COLORS.neutral[400],
  },
});
```

**packages/ui/src/Card.tsx**:
```typescript
import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING } from '@propbot/config';

interface CardProps {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Card({ children, padding = 'md', style }: CardProps) {
  return (
    <View style={[styles.card, styles[`padding_${padding}`], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: SPACING.sm,
  },
  padding_md: {
    padding: SPACING.md,
  },
  padding_lg: {
    padding: SPACING.lg,
  },
});
```

**packages/ui/src/index.ts**:
```typescript
export { Button } from './Button';
export { Card } from './Card';
```

**packages/api/package.json**:
```json
{
  "name": "@propbot/api",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**packages/api/src/client.ts**:
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// These will be set by environment variables in the apps
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export type { Database };
```

**packages/api/src/types.ts**:
```typescript
// Placeholder - will be generated from Supabase schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          type: 'owner' | 'tenant' | 'admin';
          first_name: string;
          last_name: string;
          phone: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      // More tables will be added as we build
    };
  };
}
```

**packages/api/src/index.ts**:
```typescript
export { supabase } from './client';
export type { Database } from './types';
```

### 4. Owner App (Expo)

Create with Expo CLI and configure:

**apps/owner/package.json**:
```json
{
  "name": "@propbot/owner-app",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "build": "expo export",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app/"
  },
  "dependencies": {
    "@propbot/api": "workspace:*",
    "@propbot/config": "workspace:*",
    "@propbot/ui": "workspace:*",
    "expo": "~50.0.0",
    "expo-router": "~3.4.0",
    "expo-status-bar": "~1.11.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "react-native-safe-area-context": "4.8.2",
    "react-native-screens": "~3.29.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0"
  }
}
```

**apps/owner/app/_layout.tsx**:
```typescript
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#171717',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

**apps/owner/app/(tabs)/_layout.tsx**:
```typescript
import { Tabs } from 'expo-router';
import { COLORS } from '@propbot/config';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary[600],
        tabBarInactiveTintColor: COLORS.neutral[400],
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          tabBarLabel: 'Properties',
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
```

**apps/owner/app/(tabs)/index.tsx**:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card } from '@propbot/ui';
import { COLORS, SPACING } from '@propbot/config';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Good morning, Owner</Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>This Month</Text>
        <Text style={styles.amount}>$0 collected</Text>
        <Text style={styles.subtext}>$0 expected</Text>
      </Card>

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <Button title="Add Property" onPress={() => {}} style={styles.button} />
      <Button title="View Messages" onPress={() => {}} variant="outline" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
    padding: SPACING.md,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.neutral[900],
    marginBottom: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: SPACING.xs,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.neutral[900],
  },
  subtext: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[800],
    marginBottom: SPACING.md,
  },
  button: {
    marginBottom: SPACING.sm,
  },
});
```

**apps/owner/app/(tabs)/properties.tsx**:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@propbot/config';

export default function PropertiesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>No properties yet</Text>
      <Text style={styles.hint}>Add your first property to get started</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[700],
    marginBottom: SPACING.sm,
  },
  hint: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
});
```

**apps/owner/app/(tabs)/messages.tsx**:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@propbot/config';

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>No messages</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[700],
  },
});
```

**apps/owner/app/(tabs)/settings.tsx**:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@propbot/ui';
import { COLORS, SPACING, APP_VERSION } from '@propbot/config';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.version}>PropBot v{APP_VERSION}</Text>
      <Button title="Sign Out" onPress={() => {}} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
    padding: SPACING.md,
  },
  version: {
    fontSize: 14,
    color: COLORS.neutral[500],
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
});
```

### 5. Tenant App (Similar structure)

Create tenant app with same pattern but different screens.

## Files to Create

- `/package.json` - Root monorepo config
- `/turbo.json` - Turborepo config
- `/tsconfig.json` - Root TypeScript config
- `/pnpm-workspace.yaml` - Workspace config
- `/packages/config/package.json`
- `/packages/config/src/index.ts`
- `/packages/ui/package.json`
- `/packages/ui/src/Button.tsx`
- `/packages/ui/src/Card.tsx`
- `/packages/ui/src/index.ts`
- `/packages/api/package.json`
- `/packages/api/src/client.ts`
- `/packages/api/src/types.ts`
- `/packages/api/src/index.ts`
- `/apps/owner/package.json`
- `/apps/owner/app.json`
- `/apps/owner/tsconfig.json`
- `/apps/owner/app/_layout.tsx`
- `/apps/owner/app/(tabs)/_layout.tsx`
- `/apps/owner/app/(tabs)/index.tsx`
- `/apps/owner/app/(tabs)/properties.tsx`
- `/apps/owner/app/(tabs)/messages.tsx`
- `/apps/owner/app/(tabs)/settings.tsx`
- `/apps/tenant/` (same structure as owner)

## Validation Commands

```bash
# Install dependencies
pnpm install

# Check TypeScript
pnpm typecheck

# Build all packages
pnpm build

# Start owner app
cd apps/owner && pnpm dev
```

## Commit Message

```
feat(setup): initialize PropBot monorepo

- Configure pnpm workspaces + Turborepo
- Create shared packages (ui, api, config)
- Initialize owner app with Expo Router
- Initialize tenant app with Expo Router
- Set up TypeScript across all packages
```

## Notes

- Do NOT set up Supabase connection yet (Mission 02)
- Do NOT add authentication yet (Mission 02)
- Focus only on project structure and navigation

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
N/A — no database changes in this mission

### Feature Verification (Mission-Specific)
- [ ] `pnpm install` completes without errors from root
- [ ] All workspace packages resolve correctly (`@propbot/ui`, `@propbot/api`, `@propbot/config`)
- [ ] `pnpm build` completes successfully via Turborepo
- [ ] Owner app starts in Expo Go without crash
- [ ] Tenant app starts in Expo Go without crash
- [ ] Tab navigation works in owner app (Home, Properties, Messages, Settings)
- [ ] Tab navigation works in tenant app
- [ ] Shared UI components render correctly (Button, Card)
- [ ] Config package exports (COLORS, SPACING, APP_VERSION) accessible from apps
- [ ] TypeScript strict mode enabled and passing across all packages

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
N/A — this is the first mission

### Auth & Security
N/A — no authentication in this mission
