# EX Research Ghost Theme

This is a Ghost CMS theme converted from the static HTML website, preserving all Three.js animations and interactive features.

## Installation

1. Zip the entire `ghost-theme` directory
2. In Ghost Admin, go to Settings > Design
3. Click "Change theme" > "Upload theme"
4. Select the zip file

## JavaScript Files

The JavaScript code needs to be extracted from the original HTML files:

- `articles/index.html` (lines 2246-3929) → `assets/js/articles-threejs.js`
- `article/index.html` (water animation script) → `assets/js/article-water.js`
- `about/index.html` and `contact/index.html` → `assets/js/pages-threejs.js`

### Key Changes Made:

1. **Removed hardcoded articles array** - Articles are now rendered via Handlebars in `index.hbs`
2. **Updated asset paths** - Changed from relative paths to Ghost's `{{asset}}` helper
3. **Preserved Three.js code** - All Three.js initialization and animation code should be preserved
4. **Removed `renderArticles()` function** - No longer needed as Ghost handles article rendering

## Template Structure

- `default.hbs` - Base layout with header/footer
- `index.hbs` - Homepage with articles listing
- `post.hbs` - Individual article template
- `page.hbs` - Static pages (about, contact)
- `partials/header.hbs` - Navigation header

## Assets

- CSS: `assets/css/main.css` (copied from articles/main.css)
- Fonts: `assets/fonts/` (Public Sans and custom fonts)
- Images: `assets/images/` (logo, cloud images, article previews)

## Notes

- The contact form will need a custom endpoint or third-party service (Ghost doesn't support forms natively)
- Three.js animations are preserved and should work with Ghost's template system
- All asset paths use Ghost's `{{asset}}` helper for proper URL generation

