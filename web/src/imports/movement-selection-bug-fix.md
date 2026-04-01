🎨 BUG FIX REQUEST
Music & Movement Section – Movement Selection Clipped

Module: Circle Time → Music & Movement

🚨 ISSUE

The Movement Selection area is:

Visually clipped

Partially cut off

Overflowing outside its container

Looking broken or misaligned

This creates a buggy, unpolished experience.

✅ REQUIRED FIX
1️⃣ Fix Container Constraints

Ensure parent container uses proper Auto Layout

Remove fixed height if causing clipping

Set height to:

Hug contents OR

Fill container with internal scroll

Do NOT allow content to overflow outside frame.

2️⃣ Prevent Text Clipping

Movement prompts must:

Wrap naturally (no forced single-line overflow)

Have proper padding (16–20px)

Maintain readable line height

Avoid being cut at bottom

3️⃣ Fix Scroll Behavior (If Needed)

If movement options are scrollable:

Enable vertical scroll inside container

Hide horizontal scrolling

Add subtle fade or scrollbar indicator

Ensure smooth touch scrolling on mobile

4️⃣ Adjust Layout (Mobile First)

Mobile:

Structure should be:

Video

Movement Prompt Container

Controls

Movement container:

Rounded corners (16px)

Full width

Min height (e.g., 120–160px)

Flexible height depending on content

No overlap with controls.

5️⃣ Desktop / iPad Fix

Ensure movement panel expands properly

Remove fixed height constraints

Maintain consistent spacing from video

Align properly within main content column

6️⃣ Clean Visual Polish

Ensure no text touches edges

Add consistent spacing between prompts

Prevent overlapping UI layers

Test with long movement descriptions

🎯 EXPECTED RESULT

Movement selection should now feel:

✔ Fully visible
✔ Smooth
✔ Clean
✔ Structured
✔ Professional

No clipping.
No awkward cropping.
No broken spacing.