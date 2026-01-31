// Casa UI Components - Design System
// Based on BRAND-AND-UI.md specification

// Core Components
export { Button, type ButtonProps } from './components/Button';
export { Card, type CardProps } from './components/Card';
export { Input, type InputProps } from './components/Input';
export { Checkbox, type CheckboxProps } from './components/Checkbox';
export { Chip, type ChipProps } from './components/Chip';
export { DatePicker, type DatePickerProps } from './components/DatePicker';
export { SearchInput, type SearchInputProps } from './components/SearchInput';

// Display Components
export { Avatar, type AvatarProps } from './components/Avatar';
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge';
export { CasaLogo, type CasaLogoProps } from './components/CasaLogo';
export { StarRating, type StarRatingProps } from './components/StarRating';
export { ConditionBadge, type ConditionBadgeProps, type ConditionRatingValue } from './components/ConditionBadge';

// Feature Gating Components
export { FeatureGate, UpgradePrompt, type FeatureGateProps, type UpgradePromptProps } from './components/FeatureGate';

// Application Components
export { ProgressSteps, type ProgressStepsProps } from './components/ProgressSteps';
export { StatusTimeline, type StatusTimelineProps, type TimelineEvent } from './components/StatusTimeline';
export { ContactButton, type ContactButtonProps } from './components/ContactButton';
export { FileUpload, type FileUploadProps, type UploadedFile } from './components/FileUpload';

// Payment Components
export { PaymentStatusBadge, type PaymentStatusBadgeProps, type PaymentStatusType } from './components/PaymentStatusBadge';
export { CurrencyDisplay, type CurrencyDisplayProps } from './components/CurrencyDisplay';

// Inspection Components
export { SignatureCapture, type SignatureCaptureProps } from './components/SignatureCapture';

// Layout Components
export { ScreenContainer, type ScreenContainerProps } from './components/ScreenContainer';
export { StepIndicator, type StepIndicatorProps } from './components/StepIndicator';

// Re-export theme for convenience
export { THEME, type Theme } from '@casa/config';
