# Casa Brand & UI Design System

> **Design Philosophy**: Premium, trustworthy, effortlessly simple. Casa should feel like a $100M ARR product - confident, refined, and delightful to use. Every pixel earns its place.

---

## 1. Brand Identity

### 1.1 Logo

**Primary Logo**: Casa wordmark + icon mark

The brand uses a deep navy colour with an elegant serif/script wordmark and abstract flowing icon mark to communicate:
- **Premium quality**: Refined, confident, trustworthy
- **Warmth**: Casa (home) — properties are cared for
- **Intelligence**: The flowing mark suggests AI-powered adaptability

**Logo Variations**:
```
Primary:      casa (wordmark, elegant serif)
Icon:         Abstract flowing shape (icon mark)
Combined:     Icon + wordmark
```

**Logo Files**:
- `marketing/logos/casa.png` — Wordmark (2481x2481px, transparent)
- `marketing/logos/casa_logo.png` — Icon mark (1241x1241px, transparent)

**Logo Specifications**:
- Wordmark font: Elegant serif/script
- Minimum size: 24px height
- Clear space: 1x logo height on all sides

**Logo Colors**:
- Primary logo colour: `#1B1464` (Casa Navy)
- On dark backgrounds: `#FAFAFA` (off-white)
- Never use pure black (#000) or pure white (#FFF)

### 1.2 Brand Voice

**Tone**: Confident, helpful, quietly competent

| Do | Don't |
|----|-------|
| "Your rent was collected" | "We successfully processed the payment!" |
| "3 things need attention" | "ALERT: Action required!!!" |
| "Maintenance scheduled for Tuesday" | "We've gone ahead and booked..." |

**Writing Principles**:
1. **Be direct**: State facts, not feelings
2. **Be calm**: No urgency theater, no excessive exclamation
3. **Be human**: Use contractions, speak naturally
4. **Be confident**: Don't hedge with "try to" or "attempt to"

---

## 2. Color System

### 2.1 Core Palette

```
BACKGROUND
──────────────────────────────────
Canvas          #FAFAFA    rgb(250, 250, 250)    Primary background
Surface         #FFFFFF    rgb(255, 255, 255)    Cards, elevated elements
Subtle          #F5F5F4    rgb(245, 245, 244)    Secondary backgrounds

TEXT
──────────────────────────────────
Primary         #0A0A0A    rgb(10, 10, 10)       Headlines, primary text
Secondary       #525252    rgb(82, 82, 82)       Body text, descriptions
Tertiary        #A3A3A3    rgb(163, 163, 163)    Placeholders, hints
Inverse         #FAFAFA    rgb(250, 250, 250)    Text on dark backgrounds

BRAND
──────────────────────────────────
Casa Navy       #1B1464    rgb(27, 20, 100)      Primary brand colour
Casa Indigo     #4338CA    rgb(67, 56, 202)      Secondary brand accent
Warm Subtle     #FAF8F5    rgb(250, 248, 245)    Warm cream background tint

SEMANTIC
──────────────────────────────────
Success         #16A34A    rgb(22, 163, 74)      Positive states, money in
Warning         #CA8A04    rgb(202, 138, 4)      Attention needed
Error           #DC2626    rgb(220, 38, 38)      Problems, money out
Info            #2563EB    rgb(37, 99, 235)      Informational

SEMANTIC BACKGROUNDS (for status pills/badges)
──────────────────────────────────
Success Bg      #F0FDF4    rgb(240, 253, 244)
Warning Bg      #FEFCE8    rgb(254, 252, 232)
Error Bg        #FEF2F2    rgb(254, 242, 242)
Info Bg         #EFF6FF    rgb(239, 246, 255)
```

### 2.2 Color Usage Rules

1. **Never use pure black (#000000)** - Use Casa Navy (#0A0A0A) instead
2. **Never use pure white (#FFFFFF) as background** - Use Canvas (#FAFAFA)
3. **Cards are white (#FFFFFF)** - They float above the canvas
4. **Limit accent colors** - UI should be 95% neutrals, 5% color
5. **Color = meaning** - Don't use color decoratively

---

## 3. Typography

### 3.1 Font Stack

```
Primary:    SF Pro Display / Inter
Mono:       SF Mono / JetBrains Mono
Fallback:   -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

### 3.2 Type Scale

```
Display     32px    800     -0.02em    Hero numbers, key metrics
Heading 1   24px    700     -0.01em    Screen titles
Heading 2   20px    600     -0.01em    Section headers
Heading 3   17px    600     0          Card titles
Body        15px    400     0          Primary content
Body Small  13px    400     0          Secondary content
Caption     11px    500     0.02em     Labels, timestamps
```

### 3.3 Typography Rules

1. **Line height**: 1.5 for body text, 1.2 for headings
2. **Max width**: 65 characters for body text
3. **Hierarchy**: Max 3 levels of type hierarchy per screen
4. **Weight**: Use 400 (regular) and 600 (semibold) primarily
5. **Alignment**: Left-align text, except centered for empty states

---

## 4. Spacing System

### 4.1 Base Unit

**Base unit: 4px**

All spacing should be multiples of 4px for visual consistency.

```
4    xs      Tight spacing (icon gaps)
8    sm      Default component padding
12   md      Between related elements
16   base    Standard spacing
24   lg      Between sections
32   xl      Major section breaks
48   2xl     Screen padding top/bottom
64   3xl     Hero spacing
```

### 4.2 Spacing Rules

1. **Screen padding**: 16px horizontal, 24px vertical
2. **Card padding**: 16px all sides
3. **Between cards**: 12px
4. **Section spacing**: 32px
5. **Touch targets**: Minimum 44px height

---

## 5. Component Specifications

### 5.1 Cards

**Standard Card**:
```
Background:     #FFFFFF
Border:         none
Border Radius:  16px
Shadow:         0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)
Padding:        16px
```

**Elevated Card** (for primary actions):
```
Background:     #FFFFFF
Border:         none
Border Radius:  16px
Shadow:         0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)
Padding:        16px
```

**Interactive Card** (tappable):
```
Same as Standard Card
+ Active state: scale(0.98), shadow reduces
+ Transition: 150ms ease-out
```

### 5.2 Buttons

**Primary Button**:
```
Background:     #1B1464 (Casa Navy)
Text:           #FAFAFA
Border Radius:  12px
Height:         48px (touch-friendly)
Padding:        0 24px
Font:           15px, 600 weight
Shadow:         none
```

**Secondary Button**:
```
Background:     transparent
Text:           #1B1464
Border:         1.5px solid #E5E5E5
Border Radius:  12px
Height:         48px
Padding:        0 24px
Font:           15px, 600 weight
```

**Text Button**:
```
Background:     transparent
Text:           #1B1464
Underline:      none
Font:           15px, 500 weight
```

**Button States**:
```
Hover:          opacity 0.9
Active:         opacity 0.8, scale(0.98)
Disabled:       opacity 0.4, no pointer
Loading:        Show spinner, maintain width
```

### 5.3 Input Fields

```
Background:     #FFFFFF
Border:         1.5px solid #E5E5E5
Border Radius:  12px
Height:         48px
Padding:        0 16px
Font:           15px, 400 weight

Focus:          border-color: #1B1464
Error:          border-color: #DC2626
Placeholder:    color: #A3A3A3
```

### 5.4 Status Badges

```
Border Radius:  9999px (pill)
Padding:        4px 12px
Font:           11px, 500 weight, uppercase
Letter Spacing: 0.05em

Variants:
- Success:  bg: #F0FDF4, text: #16A34A
- Warning:  bg: #FEFCE8, text: #CA8A04
- Error:    bg: #FEF2F2, text: #DC2626
- Neutral:  bg: #F5F5F4, text: #525252
```

### 5.5 Bottom Tab Bar

```
Background:     #FFFFFF
Height:         83px (includes safe area)
Shadow:         0 -1px 0 rgba(0,0,0,0.04)
Icon Size:      24px
Label:          11px, 500 weight

Active:         #1B1464 (icon + label)
Inactive:       #A3A3A3
```

### 5.6 Floating Action Button (FAB)

```
Background:     #1B1464
Size:           56px
Border Radius:  16px
Shadow:         0 4px 12px rgba(0,0,0,0.15)
Icon:           24px, #FAFAFA

Position:       bottom-right, 16px from edges
```

---

## 6. Layout Patterns

### 6.1 Screen Structure

```
┌─────────────────────────────────┐
│         Safe Area Top           │
├─────────────────────────────────┤
│                                 │
│  Greeting + Context             │  ← "Hey Robbie" + date
│                                 │
├─────────────────────────────────┤
│                                 │
│  Primary Content                │  ← Cards, lists, etc.
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│         Tab Bar                 │
│         Safe Area Bottom        │
└─────────────────────────────────┘
```

### 6.2 Greeting Pattern

```tsx
<View style={styles.greeting}>
  <Text style={styles.greetingText}>Hey Robbie</Text>
  <Text style={styles.greetingSubtext}>Let's check on your properties</Text>
</View>
```

### 6.3 Section Headers

```tsx
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Needs Attention</Text>
  <Text style={styles.sectionCount}>3</Text>
</View>
```

### 6.4 Empty States

- Center vertically and horizontally
- Use a subtle illustration or icon (48px, #A3A3A3)
- Headline: 17px, 600 weight
- Description: 15px, 400 weight, #525252
- CTA button if applicable

---

## 7. Motion & Animation

### 7.1 Timing

```
Instant:        0ms         State changes (color)
Fast:           100ms       Micro-interactions
Normal:         200ms       Standard transitions
Slow:           300ms       Larger movements
```

### 7.2 Easing

```
Default:        ease-out    Most transitions
Enter:          ease-out    Elements appearing
Exit:           ease-in     Elements disappearing
Bounce:         spring      Playful moments (rare)
```

### 7.3 Animation Rules

1. **Purposeful**: Every animation should communicate something
2. **Subtle**: Users shouldn't notice animations, just feel smoothness
3. **Fast**: Err on the side of faster
4. **Consistent**: Same action = same animation everywhere

---

## 8. Iconography

### 8.1 Icon Style

- **Style**: Outline, 1.5px stroke
- **Size**: 24px standard, 20px compact
- **Source**: Lucide Icons (consistent with modern apps)
- **Color**: Inherit from text color

### 8.2 Key Icons

```
Properties      Home / Building2
Tenants         Users
Payments        CreditCard / DollarSign
Maintenance     Wrench / Tool
Messages        MessageSquare
Settings        Settings
Add             Plus
Back            ChevronLeft
More            MoreHorizontal
```

---

## 9. Imagery

### 9.1 Property Photos

```
Aspect Ratio:   16:9 or 4:3
Border Radius:  12px
Placeholder:    #F5F5F4 with building icon
```

### 9.2 Avatar/Profile Photos

```
Size:           40px (list), 64px (profile), 80px (detail)
Border Radius:  9999px (circle)
Fallback:       Initials on #F5F5F4 background
```

---

## 10. Accessibility

### 10.1 Requirements

1. **Contrast**: Minimum 4.5:1 for body text, 3:1 for large text
2. **Touch targets**: Minimum 44x44px
3. **Focus states**: Visible focus rings on all interactive elements
4. **Screen readers**: All images have alt text, buttons have labels

### 10.2 Color Blind Considerations

- Don't rely on color alone to convey meaning
- Always pair color with icons or text
- Test with color blindness simulators

---

## 11. Dark Mode (Future)

Reserve for future implementation. When implemented:

```
Canvas:         #0A0A0A
Surface:        #171717
Text Primary:   #FAFAFA
Text Secondary: #A3A3A3
```

---

## 12. Implementation Checklist

When building any screen, verify:

- [ ] Background is Canvas (#FAFAFA), not white
- [ ] Cards have correct border-radius (16px) and shadow
- [ ] Typography follows the scale exactly
- [ ] Spacing uses 4px base unit
- [ ] Touch targets are minimum 44px
- [ ] No pure black or pure white used
- [ ] Color is only used for semantic meaning
- [ ] Animations are fast (≤200ms) and purposeful

---

## 13. Code Reference

### Theme Object (TypeScript)

```typescript
export const THEME = {
  colors: {
    // Backgrounds
    canvas: '#FAFAFA',
    surface: '#FFFFFF',
    subtle: '#F5F5F4',

    // Text
    textPrimary: '#0A0A0A',
    textSecondary: '#525252',
    textTertiary: '#A3A3A3',
    textInverse: '#FAFAFA',

    // Brand
    brand: '#1B1464',
    brandIndigo: '#4338CA',
    warmSubtle: '#FAF8F5',

    // Semantic
    success: '#16A34A',
    successBg: '#F0FDF4',
    warning: '#CA8A04',
    warningBg: '#FEFCE8',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    info: '#2563EB',
    infoBg: '#EFF6FF',

    // UI
    border: '#E5E5E5',
    borderFocus: '#1B1464',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },

  fontSize: {
    caption: 11,
    bodySmall: 13,
    body: 15,
    h3: 17,
    h2: 20,
    h1: 24,
    display: 32,
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
  },
} as const;
```

---

---

## 14. App Mockup Aesthetic (Marketing Site)

When building interactive mockup representations of the app for the marketing website, follow this visual language (inspired by the reference images):

- **White/light backgrounds** with generous whitespace
- **Large bold greeting** as hero text ("Hey Sarah" — 28-32px, font-weight 700)
- **Rounded white cards** with very subtle shadows and 16-20px border radius
- **Minimal outline icons** (1.5px stroke, monochrome — Lucide style)
- **Pill-shaped active states** (Casa Navy pill background for selected tabs)
- **2x2 action card grids** with icon above, bold title, subtle description below
- **Warm neutral accents** (cream/beige #FAF8F5 for card backgrounds where needed)
- **Navy-to-indigo gradient** for featured/hero elements within the app
- **Bottom navigation** with simple outline icons, active = filled or navy colour
- **Typography hierarchy**: Large bold title → medium semibold subtitle → small regular body
- **No busy UI** — each screen shows 3-5 elements max, plenty of breathing room

---

*This design system is the source of truth for all Casa UI decisions. When in doubt, refer here. When building, follow exactly.*
