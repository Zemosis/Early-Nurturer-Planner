🎨 BUG FIX REQUEST
Daily Schedule – Long Activity Text Clips Edit Button (Mobile)

Module: Daily Schedule Tab

🚨 ISSUE

When an activity has long text:

The Edit (Pen) button is pushed off-screen

Teachers cannot access it to edit the activity

The layout looks broken or cramped

This is a mobile-specific problem due to limited width and horizontal overflow.

✅ REQUIRED FIX
1️⃣ Flexible Text Wrapping

Allow activity text to wrap naturally to multiple lines

Do NOT truncate text unless absolutely necessary

Set word-wrap: break-word or equivalent

Limit maximum lines if needed, but ensure Edit button remains visible

2️⃣ Edit Button Placement

Keep Edit (Pen) icon aligned top-right of the activity card

Ensure it floats independently of the text width

Use absolute positioning relative to card if needed

Add enough padding from card edges (12–16px)

3️⃣ Auto Layout / Responsive Fix

Use a flex container for activity card:

Horizontal Flex: 
[Activity Text (flex-grow: 1)] [Edit Button (fixed width)]

This ensures the button always stays visible, regardless of text length

Maintain internal padding (16px)

4️⃣ Mobile Touch & Scroll

Ensure card height grows dynamically with text

Prevent vertical overflow from clipping content

Scrollable container for the schedule if needed

Edit button always tappable

5️⃣ Visual Polishing

Multi-line text should have 16–20px line height

Edit button should remain:

44px tap target

Circular background for clarity

Prevent overlap with timestamp or other UI elements

🎯 EXPECTED RESULT

Long activity text wraps gracefully

Edit button always visible and tappable

No horizontal overflow

Mobile schedule looks clean and professional

Teachers can edit any activity without frustration