# Casa Visual Standard & Design Guidelines

> **The Standard**: Casa should feel like it was built by a team of fifty over three years, not by a startup in a sprint. Every pixel, every transition, every word earns its place. The app masks immense complexity behind effortless calm. Users should feel the craft without ever being able to point to why.

---

## Part I: Brand Philosophy

### 1.1 Brand Personality

Casa is a **calm, competent friend** who happens to be incredibly good at property management. Not corporate. Not "tech startup." Think: the competence of a premium law firm, the warmth of a trusted neighbour, and the quiet confidence of someone who has done this a thousand times.

**Casa is:**
- Confident without being loud
- Helpful without being eager
- Intelligent without being showy
- Warm without being casual
- Premium without being exclusive

**Casa is not:**
- A dashboard full of charts trying to prove its value
- A feature-showcase app competing for screen space
- A corporate tool that feels like work
- A chatbot pretending to be a person

### 1.2 Design Principles

These five principles govern every design decision. They are ordered by priority.

**1. Breathing Room**
Every screen should feel like it has too much space. If you think there's enough whitespace, add more. The app should feel like it *doesn't need to try hard*. Density is the enemy. Calm is the goal.

**2. Purposeful Restraint**
Every element must justify its existence. If removing something doesn't hurt comprehension, remove it. If a label can be replaced by context, remove it. If two cards can become one, merge them. Show 3-5 elements per screen, never 10.

**3. Invisible Complexity**
Casa manages leases, inspections, arrears, maintenance, compliance, payments, and communications. The user should never feel that weight. Each screen reveals only what matters *right now*. Complexity lives behind progressive disclosure, behind smooth expand/collapse, behind an AI that handles things before you ask.

**4. Felt Quality**
Users can't articulate why something feels premium, but they know instantly. Felt quality comes from: consistent spacing, smooth motion, haptic feedback on meaningful actions, skeleton screens instead of spinners, animated numbers instead of static text, sounds that confirm actions. These details compound.

**5. Never Breaks**
A premium app that crashes, shows broken layouts, truncates text, or displays error codes destroys all trust instantly. Every edge case is handled. Every empty state is designed. Every error state is helpful. The app never shows a raw error, a blank screen, or a layout that doesn't feel intentional.

### 1.3 Brand Voice

**Tone**: Direct, calm, quietly competent.

| Do | Don't |
|----|-------|
| "Your rent was collected" | "We successfully processed your payment!" |
| "3 things need attention" | "ALERT: Action required!!!" |
| "Maintenance scheduled for Tuesday" | "We've gone ahead and booked a maintenance visit" |
| "October: all rent collected." | "Congratulations! All payments received!" |
| "Let's manage your property" | "Get started on your property management journey!" |

**Writing Rules:**
1. **Be direct** - State facts, not feelings. "Rent is overdue" not "Unfortunately, it appears rent hasn't been received yet."
2. **Be calm** - No urgency theatre. No exclamation marks in the UI. If something needs attention, say so plainly.
3. **Be human** - Use contractions. "You've got" not "You have received." Speak like a person, not a system.
4. **Be confident** - Never hedge. "Inspection scheduled" not "We'll try to schedule the inspection." Casa doesn't try. Casa does.
5. **Be brief** - One sentence where others use three. The less you say, the more each word matters.

---

## Part II: Visual Identity

### 2.1 Logo

**Primary Mark**: Casa wordmark in elegant serif, paired with an abstract flowing icon mark.

The flowing mark communicates AI-powered intelligence and adaptability. The serif wordmark communicates trust and premium positioning.

```
Wordmark:     "casa" — elegant serif/script
Icon Mark:    Abstract flowing shape
Combined:     Icon + wordmark (horizontal lockup)
```

**Logo Files:**
- `marketing/logos/casa.png` — Wordmark (2481x2481, transparent)
- `marketing/logos/casa_logo.png` — Icon mark (1241x1241, transparent)

**Logo Specifications:**
- Primary colour: Casa Navy `#1B1464`
- On dark backgrounds: Off-white `#FAFAFA`
- Never pure black `#000000` or pure white `#FFFFFF`
- Minimum size: 24px height
- Clear space: 1x logo height on all sides
- Never distort, rotate, add effects, or place on busy backgrounds

### 2.2 App Icon

The app icon uses the Casa icon mark on a Casa Navy `#1B1464` background with the warm cream `#FAF8F5` mark. The icon should feel like a premium object — no text, no gradients, no noise. Just the mark, centred, with generous padding.

```
Background:     #1B1464 (Casa Navy)
Mark Color:     #FAF8F5 (Warm Cream)
Corner Radius:  iOS super-ellipse (automatic)
Padding:        ~20% of icon size on all sides
```

---

## Part III: Colour System

### 3.1 Core Palette

The palette is deliberately restrained. The UI is 95% neutral tones. Colour is reserved for meaning — it is never decorative.

```
BACKGROUNDS
────────────────────────────────────────────────────
Canvas            #FAFAFA     Primary app background. NOT white.
Surface           #FFFFFF     Cards, sheets, elevated elements.
Warm Subtle       #FAF8F5     Alternate sections, warm tinted backgrounds.
Subtle            #F5F5F4     Disabled backgrounds, dividers, secondary surfaces.

TEXT
────────────────────────────────────────────────────
Primary           #0A0A0A     Headlines, primary content. NOT pure black.
Secondary         #525252     Body text, descriptions, secondary labels.
Tertiary          #A3A3A3     Placeholders, hints, timestamps, disabled text.
Inverse           #FAFAFA     Text on dark/brand backgrounds.

BRAND
────────────────────────────────────────────────────
Casa Navy         #1B1464     Primary brand. Buttons, active states, headers.
Casa Navy Light   #2D2080     Hover/pressed states, gradient terminus.
Casa Indigo       #4338CA     Accent gradients, secondary highlights.
Indigo Light      #6366F1     Tertiary accents, gradient midpoints.

SEMANTIC — Used ONLY for status and meaning
────────────────────────────────────────────────────
Success           #16A34A     Positive states. Rent collected, task complete.
Success Bg        #F0FDF4     Success badge/pill backgrounds.
Warning           #CA8A04     Attention needed. Approaching due date.
Warning Bg        #FEFCE8     Warning badge/pill backgrounds.
Error             #DC2626     Problems. Overdue rent, failed action.
Error Bg          #FEF2F2     Error badge/pill backgrounds.
Info              #2563EB     Informational. Neutral status updates.
Info Bg           #EFF6FF     Info badge/pill backgrounds.

UI ELEMENTS
────────────────────────────────────────────────────
Border            #E5E5E5     Default borders, dividers.
Border Focus      #1B1464     Focused input borders.
Overlay           rgba(0,0,0,0.4)    Background behind modals/sheets.
```

### 3.2 Colour Rules (Non-Negotiable)

1. **Never use pure black `#000000`** anywhere. Use `#0A0A0A` for the darkest text.
2. **Never use pure white `#FFFFFF` as a screen background.** Use Canvas `#FAFAFA`. Cards are `#FFFFFF` — they float *above* the canvas.
3. **Colour equals meaning.** Green = success/money in. Red = error/money out. Yellow = warning. Blue = info. Never use these colours decoratively.
4. **95/5 rule.** 95% of pixels are neutral tones. 5% are colour. If a screen feels colourful, you've used too much.
5. **Brand colour is for primary actions only.** Casa Navy appears on: primary buttons, active tab icons, focused inputs, and key interactive elements. Nowhere else.
6. **Subtle warmth via background.** Use `#FAF8F5` (Warm Subtle) instead of `#FAFAFA` for alternating sections or areas that need gentle visual separation. This warmth is almost imperceptible but prevents the app from feeling clinical.
7. **Background gradients are nearly invisible.** Where used, gradients should span from `#FFFFFF` to `#FAFAFA` or `#FAF8F5` — detectable only subconsciously. Never use visible colour gradients in content areas.

---

## Part IV: Typography

### 4.1 Typeface

```
Primary:      Inter
Fallback:     SF Pro Display, -apple-system, sans-serif
Monospace:    SF Mono, JetBrains Mono (for amounts, codes)
```

Inter is clean, modern, and excellent at small sizes. It reads beautifully on mobile screens. **Never use more than one typeface family.** The visual hierarchy comes from size and weight, never from mixing fonts.

### 4.2 Type Scale

Every text element in the app uses one of these sizes. No exceptions.

```
Token        Size    Weight    Tracking     Usage
──────────────────────────────────────────────────────────
Display      32px    800       -0.02em      Hero numbers. "$4,280 collected."
Heading 1    24px    700       -0.01em      Screen titles. "Portfolio."
Heading 2    20px    600       -0.01em      Section headers. "Needs Attention."
Heading 3    17px    600       0            Card titles. "42 Elm Street."
Body         15px    400       0            Primary content. Descriptions.
Body Small   13px    400       0            Secondary content. Metadata.
Caption      11px    500       0.02em       Labels, timestamps, badges.
```

### 4.3 Typography Rules

1. **Line height**: 1.5x for body text, 1.2x for headings, 1.0x for display numbers.
2. **Max three levels per screen.** A screen should use at most three levels of the type hierarchy. If you need four, the screen has too much information.
3. **Left-align everything** except empty state messages (centred) and hero metrics (centred).
4. **Weight palette**: Use `400` (regular) and `600` (semibold) for 95% of text. `700` and `800` are reserved for screen titles and hero numbers only.
5. **Never use underlines** for emphasis. Never use italic for UI text. Never use ALL CAPS except in badge labels (Caption size only).
6. **Numbers use tabular figures** where available, so columns of numbers align vertically.

---

## Part V: Spacing & Layout

### 5.1 Spacing Scale

All spacing is multiples of 4px. No magic numbers.

```
Token    Value    Usage
──────────────────────────────────────────
xs       4px      Tight gaps: between icon and label, inline elements.
sm       8px      Inside compact components, between badge elements.
md       12px     Between related cards, between list items.
base     16px     Standard screen padding (horizontal). Card internal padding.
lg       24px     Between content sections. Screen padding (vertical).
xl       32px     Major section breaks. Between card groups.
2xl      48px     Screen top/bottom padding. Hero spacing.
3xl      64px     Oversized spacing. Splash/onboarding screens.
```

### 5.2 Layout Rules

1. **Screen horizontal padding**: 16px on both sides. Always.
2. **Screen vertical padding**: 24px top (below safe area), 24px bottom (above tab bar).
3. **Card internal padding**: 16px on all sides.
4. **Between cards**: 12px vertical gap.
5. **Between sections**: 32px vertical gap.
6. **Touch targets**: Minimum 44x44px. No exceptions. This includes the entire tappable area, not just the visible element.
7. **Maximum content width**: On tablets, content should not exceed 600px. Centre it with side margins.

### 5.3 Screen Structure

```
┌─────────────────────────────────────────┐
│              Safe Area Top              │
├─────────────────────────────────────────┤
│    24px padding                         │
│                                         │
│    Greeting / Screen Title              │
│    Context line (optional)              │
│                                         │
│    32px gap                             │
│                                         │
│    ┌───────────────────────────────┐    │
│    │   Primary Content Card        │    │
│    └───────────────────────────────┘    │
│    12px gap                             │
│    ┌───────────────────────────────┐    │
│    │   Secondary Content Card      │    │
│    └───────────────────────────────┘    │
│                                         │
│    32px gap                             │
│                                         │
│    Section Header                       │
│    12px gap                             │
│    ┌───────────────────────────────┐    │
│    │   Content Card                │    │
│    └───────────────────────────────┘    │
│                                         │
│    24px padding                         │
├─────────────────────────────────────────┤
│              Tab Bar (83px)             │
│              Safe Area Bottom           │
└─────────────────────────────────────────┘
```

**Key principle**: Every screen should show 3-5 primary elements above the fold. If you're showing more than 5 distinct cards or sections in the viewport, the screen needs to be simplified or the content needs to be progressive-disclosed behind expandable sections.

---

## Part VI: Component Specifications

### 6.1 Cards

Cards are the primary container for content. They float above the canvas background, creating a gentle sense of depth.

**Standard Card:**
```
Background:       #FFFFFF
Border:           none
Border Radius:    16px
Padding:          16px
Shadow:           0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)
```

**Elevated Card** (primary actions, featured content):
```
Background:       #FFFFFF
Border:           none
Border Radius:    16px
Padding:          16px
Shadow:           0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)
```

**Interactive Card** (tappable):
```
Same as Standard Card, plus:
  Press state:    scale(0.98), shadow reduces to sm
  Transition:     150ms ease-out
  Haptic:         Light impact on press (expo-haptics)
```

**Card Rules:**
- Cards never have visible borders. Depth comes from shadow only.
- Cards are always full-width within screen padding (no side margins beyond the 16px screen padding).
- Card content uses the same 16px internal padding. Content inside a card never touches the card edge.
- Nested cards are forbidden. If you need hierarchy inside a card, use spacing and typography — not another card.

### 6.2 Buttons

**Primary Button (Casa Navy):**
```
Background:       #1B1464
Text:             #FAFAFA, 15px, weight 600
Border Radius:    12px
Height:           48px
Horizontal Pad:   24px
Shadow:           none
Full-width:       Yes, in forms and primary CTAs. Inline for secondary placements.
```

**Secondary Button:**
```
Background:       transparent
Text:             #1B1464, 15px, weight 600
Border:           1.5px solid #E5E5E5
Border Radius:    12px
Height:           48px
Horizontal Pad:   24px
```

**Text Button:**
```
Background:       transparent
Text:             #1B1464, 15px, weight 500
No border, no underline.
```

**Destructive Button:**
```
Background:       transparent
Text:             #DC2626, 15px, weight 600
Border:           1.5px solid #FEF2F2
Border Radius:    12px
Height:           48px
```

**Button States:**
```
Default:          As specified above.
Pressed:          opacity 0.85, scale(0.98). Haptic: light impact.
Disabled:         opacity 0.4. No pointer events. No haptic.
Loading:          Show ActivityIndicator (Casa Navy or white). Maintain button width. Disable interaction.
```

**Button Rules:**
- A screen should have at most ONE primary button. If there are two equal actions, both are secondary.
- Destructive actions (delete, cancel lease) always require a confirmation sheet. Never a single tap.
- Buttons always have loading states. No button should be tappable while its action is processing.

### 6.3 Input Fields

```
Background:       #FFFFFF
Border:           1.5px solid #E5E5E5
Border Radius:    12px
Height:           48px
Horizontal Pad:   16px
Text:             15px, weight 400, #0A0A0A
Placeholder:      15px, weight 400, #A3A3A3

Focus:            border-color transitions to #1B1464 (200ms)
Error:            border-color: #DC2626, error text below in 13px #DC2626
Disabled:         background: #F5F5F4, text: #A3A3A3
```

**Input Rules:**
- Labels sit above the input, not inside it. 13px, weight 500, #525252.
- Error messages appear below the input, not in a toast or alert.
- Inputs inside cards have no additional background — they inherit the card's white.
- Multi-line inputs (textarea) have a minimum height of 96px.

### 6.4 Status Badges

```
Shape:            Pill (border-radius: 9999px)
Padding:          4px horizontal, 12px vertical
Text:             11px, weight 500, uppercase, 0.05em letter spacing

Variants:
  Success:        bg: #F0FDF4, text: #16A34A       "PAID", "ACTIVE", "COMPLETE"
  Warning:        bg: #FEFCE8, text: #CA8A04       "DUE SOON", "IN PROGRESS"
  Error:          bg: #FEF2F2, text: #DC2626       "OVERDUE", "FAILED"
  Neutral:        bg: #F5F5F4, text: #525252       "DRAFT", "PENDING"
  Brand:          bg: #1B1464 (10% opacity), text: #1B1464   "NEW", "PRO"
```

### 6.5 Bottom Tab Bar

```
Background:       #FFFFFF
Height:           83px (includes safe area padding)
Top Border:       0.5px solid rgba(0,0,0,0.06) — barely visible
Icon Size:        24px
Label:            11px, weight 500

Active Icon:      #1B1464
Active Label:     #1B1464
Inactive Icon:    #A3A3A3
Inactive Label:   #A3A3A3
```

**Tab Bar Premium Details:**
- The active tab indicator is a smooth sliding pill that follows selection, animated with spring physics (Reanimated).
- Active icon has a subtle scale animation (1.0 → 1.05 → 1.0, spring damping).
- Tab switch triggers light haptic feedback.

### 6.6 Bottom Sheets & Modals

```
Background:       #FFFFFF
Border Radius:    24px (top corners only)
Handle:           36px wide, 4px tall, #E5E5E5, centered, 8px from top
Overlay:          rgba(0,0,0,0.4) with BlurView (expo-blur, intensity 20)
Max Height:       85% of screen height
```

**Sheet Rules:**
- Sheets always animate from bottom with spring physics. Never instant.
- Background blurs when sheet is open. This single detail elevates perceived quality more than almost anything else.
- Sheets are swipeable to dismiss. Gesture handler + Reanimated.
- Sheet content has 24px horizontal padding, 16px top padding (below handle).

### 6.7 Lists & Separators

```
List Item Height:   Minimum 56px (for touch)
Separator:          0.5px solid #F5F5F4, inset 16px from left
Item Padding:       16px horizontal, 12px vertical
```

**List Rules:**
- Lists inside cards use separators. Lists on the canvas (between cards) use spacing only — no separators.
- Swipeable list items reveal actions with 60% opacity background colour (success green for approve, error red for delete).
- Long lists (10+ items) use skeleton loading on scroll, not a loading spinner at the bottom.

---

## Part VII: Iconography

### 7.1 Icon System

```
Library:          Lucide Icons (lucide-react-native)
Style:            Outline, 1.5px stroke weight
Default Size:     24px
Compact Size:     20px
Colour:           Inherits from text colour (currentColor)
```

### 7.2 Icon Usage Rules

1. Icons always accompany text in navigation. Never icon-only in tab bars.
2. Icon-only buttons (close, back, more) must have 44x44px touch targets.
3. Icons in cards and lists are 20px. Icons in headers and navigation are 24px.
4. Never use filled icons except for the active tab bar state.
5. Icon colour matches its adjacent text colour. Never colour an icon differently from its label.

### 7.3 Key Icon Mapping

```
Properties        Home / Building2
Portfolio         LayoutGrid
Tenants           Users
Payments          Wallet / CreditCard
Maintenance       Wrench
Inspections       ClipboardCheck
Messages / Chat   MessageSquare
Notifications     Bell
Settings          Settings
Add / Create      Plus
Back              ChevronLeft
Close             X
More Options      MoreHorizontal
Search            Search
Filter            SlidersHorizontal
Calendar          Calendar
Document          FileText
Camera            Camera
```

---

## Part VIII: Imagery & Media

### 8.1 Property Photos

```
Aspect Ratio:     16:9 (hero) or 4:3 (thumbnail)
Border Radius:    12px (standalone), 16px top corners (card hero)
Placeholder:      #F5F5F4 background + Building2 icon at 48px, #A3A3A3
Loading:          Skeleton pulse animation on placeholder
```

**Photo Rules:**
- Hero photos at the top of a detail screen scroll with a subtle parallax offset (scroll rate 0.7x of content). Implemented via Reanimated `useAnimatedScrollHandler`.
- Photo galleries use a horizontal FlatList with snap-to-item. Page indicator dots below, 6px diameter, active = Casa Navy, inactive = #E5E5E5.
- Never stretch or distort photos. Always `resizeMode: 'cover'`.

### 8.2 Avatars

```
Sizes:            32px (compact), 40px (list), 64px (profile), 80px (detail)
Shape:            Circle (border-radius: 9999px)
Border:           2px solid #FFFFFF (when on coloured backgrounds)
Fallback:         Initials on #F5F5F4 background, 13px weight 600 #525252
```

---

## Part IX: Motion & Animation

This section defines the motion language that makes Casa feel alive. Animation is not decoration — it is communication. Every animation tells the user something: that their action was received, that content is loading, that a state has changed, that they've accomplished something.

### 9.1 Animation Libraries (Expo / React Native)

```
Core Engine:        React Native Reanimated 3     Native thread, 60fps springs.
Gestures:           React Native Gesture Handler   Swipe, drag, pinch, long-press.
Brand Moments:      Lottie React Native            Custom After Effects → JSON animations.
Declarative:        Moti                           Simple enter/exit/layout transitions.
Blur:               expo-blur                      Background blur for sheets and overlays.
Haptics:            expo-haptics                   Tactile feedback for meaningful actions.
```

### 9.2 Timing & Easing

```
Token         Duration    Easing           Usage
──────────────────────────────────────────────────────────────
instant       0ms         —                Colour changes, state toggles
micro         100ms       ease-out         Opacity, scale on press
fast          200ms       ease-out         Standard transitions, fades
normal        300ms       ease-out         Sheet open/close, expand/collapse
spring        ~400ms      Spring config    Cards, shared elements, celebrations
                          damping: 15
                          stiffness: 150
```

**Easing Rules:**
- **Enter**: ease-out (fast start, gentle end). Elements arriving should decelerate.
- **Exit**: ease-in (gentle start, fast end). Elements leaving should accelerate away.
- **Interactive**: Spring physics for anything the user is directly manipulating (drag, swipe, pull-to-refresh).
- **Never use linear easing.** Nothing in the physical world moves at constant speed.

### 9.3 The 20 Premium Details

These are the micro-interactions and design choices that compound to make Casa feel like a $100M product. Each one is small. Together, they are transformative.

**1. Haptic Feedback on Every Meaningful Action**
When rent is confirmed: medium impact. When a tenant is approved: success notification. When a maintenance request is submitted: light impact. When pulling to refresh: soft impact at threshold. Use `expo-haptics` — one line per interaction.

**2. Skeleton Loading, Never Spinners**
When data loads, show grey placeholder shapes that pulse gently in the exact layout the content will occupy. Skeletons use `#F5F5F4` base and `#EDEDED` highlight, animating with a shimmer wave (left to right, 1.5s loop). The content area never goes blank. The user always sees structure.

**3. Animated Numbers**
Financial figures ($4,280), counts (3 properties), and metrics never appear statically. They count up from 0 with a spring-physics easing curve over 600ms. Use Reanimated's `useSharedValue` + `withSpring`. This single detail makes dashboards feel alive.

**4. State Change Morphing**
When a status changes (e.g., "Reported" → "Trade Assigned"), the badge should morph smoothly: colour cross-fades over 200ms, text cross-fades, and there's a subtle scale bounce (1.0 → 1.05 → 1.0, spring). Never jump-cut between states. Always transition.

**5. Branded Pull-to-Refresh**
Replace the default pull-to-refresh with a custom Lottie animation of the Casa icon mark gently animating. The icon rotates and pulses while refreshing, then snaps back to rest. 30 minutes to implement, signals months of polish.

**6. Delightful Empty States**
Every empty state has: a warm illustration or Lottie animation (centred, 120px), a human headline ("All quiet on the property front"), a descriptive subtitle ("No maintenance requests right now"), and an optional CTA button. Empty states are an opportunity to show personality. Never show "No items" or "No data."

**7. Contextual Celebrations**
When all rent is collected for the month: a subtle confetti burst (Lottie, 2 seconds) with a warm full-screen moment: "October: All rent collected. You earned $4,280." When a lease is signed: a gentle success animation. When onboarding completes: a warm welcome moment. Celebrate wins. Property management apps never do this, and they should.

**8. Progressive Disclosure with Spring Height**
Lease details, financial breakdowns, tenant information: these expand and collapse with spring-physics height animations (Reanimated `useAnimatedStyle` + `withSpring`). The chevron rotates smoothly. Content fades in as the container expands. Never jump-cut content in or out.

**9. Parallax Property Photos**
On property detail screens, the hero photo scrolls at 0.7x the rate of the content below it. This creates a subtle depth effect that makes the screen feel layered. Trivial with Reanimated's `useAnimatedScrollHandler` and `interpolate`.

**10. Warm Background Gradients**
Instead of flat `#FAFAFA` everywhere, use an almost-imperceptible linear gradient from `#FFFFFF` at the top to `#FAF8F5` at the bottom. The warmth is subconscious. Apple does this on nearly every screen in iOS.

**11. Animated Tab Bar Indicator**
The bottom tab bar has a smooth sliding pill indicator that follows selection. When switching tabs, the pill translates horizontally with spring physics. The selected icon scales up subtly (1.0 → 1.05). Haptic feedback on each tab switch.

**12. Blur Behind Overlays**
When a bottom sheet or modal appears, the background content blurs (expo-blur, intensity 15-20). Combined with the dark overlay, this creates a focus effect that feels native-iOS quality. This is the single easiest way to make an app feel premium.

**13. Smart Date Formatting**
Never display raw dates. "2026-02-13" becomes:
- "Just now" (< 1 minute)
- "5 min ago" (< 1 hour)
- "Today at 2:30 PM" (today)
- "Yesterday" (yesterday)
- "Last Tuesday" (this week)
- "12 Feb" (this year)
- "12 Feb 2025" (previous years)

**14. AI Typing Indicator**
In the chat interface, when the AI is processing, show three dots pulsing in sequence (each dot scales 1.0 → 1.3 → 1.0 with staggered timing). This makes the AI feel like a person composing a thoughtful response, not a machine processing a request.

**15. Sound Design (Optional, High Impact)**
A soft, pleasant chime when rent is received. A gentle notification sound that is distinctly "Casa." Stripe's payment "cha-ching" is iconic. A 2-3 second custom sound costs $20-50 on Fiverr and transforms the experience.

**16. Gesture-Driven Navigation**
Swipe right to go back (with parallax peek of the previous screen). Swipe down to dismiss sheets and modals. Long-press cards for context menus (with haptic). Every gesture should feel like the app anticipated the user's intent.

**17. Intelligent Greeting**
The home screen greeting is context-aware:
- "Good morning, Robbie" (before 12pm)
- "Good afternoon, Robbie" (12pm-6pm)
- "Good evening, Robbie" (after 6pm)
With a contextual subline: "3 things need your attention" or "All properties looking good" or "Rent day is tomorrow."

**18. Shared Element Transitions**
Tapping a property card smoothly expands into the property detail screen. The photo animates from thumbnail to hero size. The title animates from card position to screen title position. This creates a sense of spatial continuity that makes navigation feel physical. Use React Navigation 7 shared transitions or `react-native-shared-element`.

**19. Layered Shadows**
Cards and elevated elements use two shadow layers:
- **Ambient**: Large, faint (offset 0/4px, opacity 0.04, radius 8) — simulates ambient light.
- **Direct**: Small, slightly stronger (offset 0/1px, opacity 0.06, radius 2) — simulates direct light.
This creates Apple's "floating" effect. Single flat drop shadows look cheap.

**20. Premium Onboarding**
3-4 screens, each with a custom Lottie animation (centred, 200px), smooth horizontal swiping with spring physics, a progress indicator that fills with spring animation, and a final screen with a single confident CTA: "Let's manage your property." This is the user's first impression. It must feel like unboxing a premium product.

### 9.4 Animation Rules (Non-Negotiable)

1. **Every animation must be purposeful.** If removing it doesn't reduce comprehension, remove it.
2. **Users should feel smoothness, not notice animations.** If someone says "nice animation," it's too much.
3. **Err on the side of faster.** A 150ms transition that feels snappy is better than a 400ms transition that feels luxurious. Speed = respect for the user's time.
4. **Same action = same animation everywhere.** A card press feels the same on every screen. A sheet opens the same way every time. Consistency builds subconscious trust.
5. **Animations run on the native thread.** Use Reanimated worklets, never `Animated` from React Native core. JS-thread animations drop frames and destroy the premium feel.
6. **Spring physics for user-driven motion.** Anything the user is touching (drag, swipe, pull) uses spring damping. Anything the system controls (enter, exit, state change) can use timed easing.
7. **Test on a real device.** Animations that look smooth in a simulator can stutter on a real phone. Always verify on hardware.

---

## Part X: Loading, Empty, and Error States

### 10.1 Loading States

**Skeleton screens are the default.** Every screen that loads data shows skeleton placeholders.

```
Skeleton Base:      #F5F5F4
Skeleton Highlight: #EDEDED
Animation:          Shimmer wave, left-to-right, 1.5s loop
Shape:              Matches the content it will replace
  - Text lines:     Rounded rectangles, 12px height, varying widths
  - Avatars:        Circles
  - Images:         Rounded rectangles matching aspect ratio
  - Cards:          Full card outlines
```

**Rules:**
- Skeleton screens appear for any load time > 200ms. Below 200ms, show content immediately.
- Never show a full-screen spinner. Never show a blank white screen.
- Inline loading (e.g., a button submitting) uses an ActivityIndicator inside the component that triggered it. The button shows a spinner and maintains its width.
- Pull-to-refresh uses the custom branded Lottie animation.

### 10.2 Empty States

Every screen has a designed empty state. No raw "No data" messages.

```
Layout:             Centred vertically and horizontally
Illustration:       Lottie animation or icon (120px, #A3A3A3 for icons)
Headline:           17px, weight 600, #0A0A0A, centred
Description:        15px, weight 400, #525252, centred, max-width 280px
CTA:                Primary or Secondary button (optional)
```

**Example Empty States:**

| Screen | Headline | Description |
|--------|----------|-------------|
| Properties | "Your portfolio starts here" | "Add your first property and Casa will handle the rest." |
| Maintenance | "All quiet on the property front" | "No maintenance requests right now." |
| Messages | "No conversations yet" | "Messages with your tenants will appear here." |
| Notifications | "You're all caught up" | "We'll let you know when something needs attention." |
| Payments | "No payments recorded" | "Payment history will appear once rent is configured." |

### 10.3 Error States

Errors are calm, helpful, and never show raw error codes or stack traces.

```
Layout:             Same as empty states but with warning/error icon
Icon:               AlertCircle (Lucide), 48px, #DC2626 or #CA8A04
Headline:           17px, weight 600, #0A0A0A
Description:        15px, weight 400, #525252 — explains what happened AND what to do
Retry Button:       Secondary button, "Try Again"
```

**Error Rules:**
- Network errors: "Couldn't connect. Check your internet and try again." + Retry button.
- Server errors: "Something went wrong on our end. We're looking into it." + Retry button.
- Permission errors: "You don't have access to this. Contact the property owner."
- Form validation errors: Inline, below the specific field, in real-time. Never a toast or alert.
- **Never show:** Raw error codes, HTTP status codes, exception messages, or "Error: undefined."

---

## Part XI: Accessibility

### 11.1 Requirements (Non-Negotiable)

1. **Colour contrast**: Minimum 4.5:1 for body text (15px and below), 3:1 for large text (17px and above).
2. **Touch targets**: Minimum 44x44px for all interactive elements. This includes the invisible tappable area, not just the visible element.
3. **Focus states**: Visible focus rings (2px solid `#1B1464`, 2px offset) on all interactive elements for keyboard/switch-control users.
4. **Screen reader labels**: All images have `accessibilityLabel`. All buttons have `accessibilityLabel` and `accessibilityHint`. All icons have labels. Decorative images use `accessibilityElementsHidden`.
5. **Semantic roles**: Use `accessibilityRole` on all interactive elements (button, link, header, image, etc.).
6. **Dynamic type**: Text respects the user's system font size preference where possible.

### 11.2 Colour Blind Considerations

- Never rely on colour alone to convey meaning. Always pair colour with an icon or text label.
- Status badges always include text labels, never colour-only indicators.
- Charts and graphs (if any) use patterns or labels in addition to colour.

---

## Part XII: Screen Density & Information Hierarchy

### 12.1 The 3-5 Rule

Every screen shows at most 3-5 primary elements above the fold. This is the single most important layout rule.

**What counts as a "primary element":**
- A card (regardless of content)
- A section header + its content
- A hero metric
- A form group (label + input + helper text)

If a screen needs to show more than 5 primary elements, the design must use one of these strategies:
1. **Progressive disclosure** — Collapsed sections that expand on tap
2. **Scrollable tabs/chips** — Filter content into categories
3. **Pagination** — "Show more" or infinite scroll with skeleton loading
4. **Navigation** — Move content to a sub-screen

### 12.2 The Squint Test

Squint at the screen until the text is unreadable. You should still be able to identify:
- Where the primary action is
- What content groups exist
- Where information hierarchy flows (top to bottom, most to least important)

If the screen looks like a uniform grey blob when squinted, it lacks hierarchy. Add whitespace between groups, increase size contrast between heading and body, or reduce the number of visible elements.

---

## Part XIII: Dark Mode (Future)

Reserved for post-launch. When implemented:

```
Canvas:           #0A0A0A
Surface:          #1A1A1A
Elevated:         #242424
Text Primary:     #FAFAFA
Text Secondary:   #A3A3A3
Text Tertiary:    #666666
Brand:            #6366F1 (Indigo Light — Casa Navy is too dark on dark backgrounds)
Border:           #2A2A2A
```

All components must be built with theme tokens from the start so dark mode is a token swap, not a rebuild.

---

## Part XIV: Implementation Reference

### 14.1 Theme Object (TypeScript)

The THEME constant in `packages/config/index.ts` is the source of truth for all values in this document. Every colour, spacing value, font size, and shadow must reference a THEME token. **Never use raw values in component styles.**

```typescript
// Correct
backgroundColor: THEME.colors.canvas

// Wrong
backgroundColor: '#FAFAFA'
```

### 14.2 Pre-Commit Checklist

Before shipping any screen, verify every item:

- [ ] Background is `THEME.colors.canvas`, not white
- [ ] All cards use 16px border-radius and layered shadows
- [ ] Typography uses only the defined scale (11, 13, 15, 17, 20, 24, 32)
- [ ] Spacing is multiples of 4px only
- [ ] Touch targets are minimum 44x44px
- [ ] No pure black `#000000` or pure white `#FFFFFF` as background
- [ ] Colour is used only for semantic meaning (95/5 rule)
- [ ] Loading state uses skeleton screens, not spinners
- [ ] Empty state has illustration + headline + description
- [ ] Error state is human-readable with a retry action
- [ ] Animations use Reanimated (native thread), not core Animated
- [ ] Haptic feedback on primary actions
- [ ] Tested on a real device (not just simulator)
- [ ] Accessibility labels on all interactive elements
- [ ] Max 3-5 primary elements visible above the fold

---

## Part XV: Reference Apps

Study these apps for specific patterns. These are the standard Casa should meet.

| App | Study For |
|-----|-----------|
| **Stripe Dashboard** | Financial data presentation, clean tables, status badges, payment success moments |
| **Linear** | Task management UI, keyboard shortcuts, minimal chrome, speed of interactions |
| **Mercury** | Banking dashboard, large hero numbers, transaction lists, trust-building design |
| **Airbnb** | Property presentation, photo galleries, smooth navigation, bottom sheets |
| **Calm** | Warmth, breathing room, onboarding flow, sound design |
| **Strava** | Celebration moments, achievement animations, data-rich but uncluttered |
| **Apple Wallet** | Card metaphor, layered depth, blur effects, gestural interactions |

---

*This document is the visual source of truth for Casa. Every screen, every component, every interaction must meet this standard. When in doubt, choose the option that feels calmer, simpler, and more confident. The app should feel like someone obsessed built it — because they did.*
