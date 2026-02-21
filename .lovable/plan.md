

## Make the Creator Dashboard Consistent with Black & White Theme

The dashboard currently has several amber/gold-colored buttons and accent elements that break the established minimalist black-and-white design. Here's what will change:

### 1. Dashboard Header Buttons (CreatorDashboard.tsx)
- **Recipients button**: Change from `bg-amber-100 text-amber-950 hover:bg-amber-200` to white foreground on transparent/outlined style matching the black-and-white theme
- **+Create button**: Same change -- switch from amber to a clean white button with dark text (or white outline)
- **Progress & Prompts buttons**: Update `border-amber-200/30 text-amber-100 hover:bg-amber-100/10` to neutral white/border styling

### 2. Quick Capture Floating Button (QuickCaptureButton.tsx)
- Change from `bg-amber-100 text-amber-950 hover:bg-amber-200` to a white button with black icon, keeping the floating circular style

### 3. Progress Summary Widget (ProgressSummaryWidget.tsx)
- Remove the amber/orange/purple gradient background (`from-amber-500/5 via-orange-500/5 to-purple-500/5`)
- Replace amber border with neutral white/border styling
- Update streak icon colors from amber to white/neutral tones
- Update achievement icon colors from purple to white/neutral tones

### Technical Details

**Files to modify:**
- `src/pages/creator/CreatorDashboard.tsx` -- lines 231, 237, 243, 249: Update button class names to use `bg-white text-black hover:bg-white/90` for primary actions and `border-white/30 text-white hover:bg-white/10` for outline buttons
- `src/components/QuickCaptureButton.tsx` -- line 34: Update FAB to `bg-white text-black hover:bg-white/90`
- `src/components/gamification/ProgressSummaryWidget.tsx` -- lines 29, 35-36, 49, 63-64: Replace colored accents with neutral white/gray equivalents

