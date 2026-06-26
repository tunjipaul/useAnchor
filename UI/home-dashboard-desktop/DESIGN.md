---
name: Anchor Personal Safety
colors:
  surface: '#fff8f6'
  surface-dim: '#efd4ce'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#ffe9e4'
  surface-container-high: '#fde2dc'
  surface-container-highest: '#f7ddd6'
  on-surface: '#261814'
  on-surface-variant: '#5a413a'
  inverse-surface: '#3d2d28'
  inverse-on-surface: '#ffede8'
  outline: '#8e7068'
  outline-variant: '#e2bfb5'
  surface-tint: '#b02f00'
  primary: '#ac2d00'
  on-primary: '#ffffff'
  primary-container: '#cf4519'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb5a0'
  secondary: '#954831'
  on-secondary: '#ffffff'
  secondary-container: '#ff9c80'
  on-secondary-container: '#78321d'
  tertiary: '#00628c'
  on-tertiary: '#ffffff'
  tertiary-container: '#007caf'
  on-tertiary-container: '#fcfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a0'
  on-primary-fixed: '#3b0900'
  on-primary-fixed-variant: '#872100'
  secondary-fixed: '#ffdbd1'
  secondary-fixed-dim: '#ffb5a0'
  on-secondary-fixed: '#3b0900'
  on-secondary-fixed-variant: '#77311c'
  tertiary-fixed: '#c8e6ff'
  tertiary-fixed-dim: '#86ceff'
  on-tertiary-fixed: '#001e2e'
  on-tertiary-fixed-variant: '#004c6d'
  background: '#fff8f6'
  on-background: '#261814'
  surface-variant: '#f7ddd6'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 33.6px
  h1:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28.6px
  h2:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 25.2px
  body:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 25.6px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14.4px
    letterSpacing: 0.04em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18.2px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 40px
  4xl: 48px
---

## Brand & Style
The design system is centered on the concept of "Active Reliability." For a personal safety application, the UI must balance the urgency of emergency situations with a calm, grounding presence during everyday use. The aesthetic is **Corporate Modern with a Utility focus**, prioritizing high legibility, clear information hierarchy, and high-contrast touch targets.

The design avoids unnecessary decorative elements, opting for a clean, structural layout that feels institutional yet accessible. The atmosphere should evoke confidence and security, ensuring the user feels in control even in high-stress environments.

## Colors
The palette is built for maximum visibility. The **Primary Burnt Orange** serves as the "action" anchor—it is used exclusively for SOS functions, primary calls-to-action, and active status indicators. 

- **Foundation:** The off-white background (`#FAFAF7`) reduces screen glare compared to pure white, providing a more comfortable reading experience.
- **Hierarchy:** Text follows a strict grayscale to ensure that the primary orange and status colors (Success/Danger) immediately draw the eye to critical information.
- **Safety States:** Use `danger_surface` for high-alert banners or critical error states to differentiate from the standard UI.

## Typography
This design system utilizes **Hanken Grotesk** for its contemporary, sharp, and highly legible characteristics. The typeface’s professional tone supports the app's reliability.

- **Scale:** Headings are kept tight to allow more room for functional interface elements on mobile screens. 
- **Readability:** Body text uses a generous 1.6 line height to ensure clarity during movement or in low-light conditions.
- **Labels:** Uppercase labels with slight tracking are reserved for metadata, category tags, and secondary navigation hints to distinguish them from actionable body text.

## Layout & Spacing
The layout follows a **fluid-to-fixed mobile-first model**. While the design scales, the core experience is optimized for a 390px width.

- **Rhythm:** A 4px base grid governs all dimensions. Use `lg (16px)` for standard outer margins and `md (12px)` for internal component spacing.
- **Touch Targets:** All interactive elements (buttons, list items) must maintain a minimum height of 48px to ensure accessibility during urgent scenarios.
- **Grid:** Use a 4-column system for mobile views with 12px gutters.

## Elevation & Depth
Elevation is used sparingly to maintain a "grounded" feel. Instead of dramatic shadows, depth is communicated through **tonal layering** and subtle borders.

- **Flat Layer (Level 0):** Background (`#FAFAF7`).
- **Surface Layer (Level 1):** White cards (`#FFFFFF`) with a `1px` border in `#E4E2DB`.
- **Card Shadow:** 0px 2px 4px rgba(26, 26, 24, 0.05). Soft and barely perceptible.
- **Modal/Overlay Layer:** Deep shadow to isolate the action (0px 12px 24px rgba(26, 26, 24, 0.15)).
- **SOS Button:** A unique pulsing animation using a semi-transparent primary color ring to indicate the "active" monitoring state.

## Shapes
The shape language is "Rounded-Soft." This avoids the aggressive sharpness of purely rectangular UI while maintaining more structure than hyper-rounded "playful" apps.

- **Small (6px):** Checkboxes, small tags, and nested input elements.
- **Medium (12px):** Default for standard buttons and input fields.
- **Large (20px):** Main content cards and bottom sheets.
- **Full:** SOS buttons and pill-style chips.

## Components
- **Primary Button:** Solid `#E8562A` background with white text. High-contrast, bold weight. Use `radius.md`.
- **SOS Button:** A large, circular (`radius.full`) button with the primary color. It should feature a secondary pulsing ring to denote active tracking.
- **Input Fields:** White surface with `#E4E2DB` border. On focus, the border shifts to the primary color with a 1px inner stroke.
- **Cards:** Utilize `radius.lg` with a white background. Use `text_secondary` for supporting descriptions and `h2` for titles.
- **Status Chips:** Use `radius.full` with low-opacity background tints of success/warning/danger colors and high-contrast text.
- **Safety Indicator:** A persistent top-bar or "sticky" element that uses the `primary_color` to show the user's "Safe" or "Active" status at a glance.