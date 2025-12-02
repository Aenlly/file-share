# FolderDetail Components

This directory contains the refactored components for the FolderDetail page.

## Structure

The original monolithic `FolderDetail.jsx` (600+ lines) has been split into smaller, focused components:

### Components

- **FileUploadCard.jsx** - Handles file upload functionality including drag-and-drop, chunked uploads, and progress tracking
- **FileListCard.jsx** - Displays the file list table with actions (preview, download, move, delete)
- **SubFolderCard.jsx** - Manages subfolder display and creation
- **MoveFileModal.jsx** - Modal for moving files between folders
- **ShareModal.jsx** - Modal for generating and managing folder share links
- **ImagePreviewModal.jsx** - Modal for previewing images with download functionality

### Custom Hook

- **useFileOperations.js** (in `hooks/`) - Encapsulates file preview and download logic

## Benefits

1. **Maintainability** - Each component has a single responsibility
2. **Reusability** - Components can be reused in other parts of the application
3. **Testability** - Smaller components are easier to test
4. **Readability** - Easier to understand and navigate the codebase
5. **Performance** - Components can be optimized individually

## Usage

```jsx
import FolderDetail from '../pages/FolderDetail'

// The main component automatically imports and uses all sub-components
```

## Component Props

### FileUploadCard
- `folderId` - The folder ID to upload files to
- `onUploadSuccess` - Callback when upload completes
- `isMobile` - Boolean for mobile responsive layout

### FileListCard
- `folderId` - The folder ID
- `files` - Array of file objects
- `isLoading` - Loading state
- `onRefresh` - Callback to refresh file list
- `isMobile` - Boolean for mobile responsive layout
- `onPreview` - Callback for image preview
- `onDownload` - Callback for file download
- `onMove` - Callback for moving files

### SubFolderCard
- `folderId` - The parent folder ID
- `subFolders` - Array of subfolder objects
- `onRefresh` - Callback to refresh subfolder list

### MoveFileModal
- `visible` - Modal visibility state
- `folderId` - Current folder ID
- `file` - File object to move
- `allFolders` - Array of all available folders
- `onClose` - Callback to close modal
- `onSuccess` - Callback when move succeeds

### ShareModal
- `visible` - Modal visibility state
- `folderId` - Folder ID to share
- `onClose` - Callback to close modal

### ImagePreviewModal
- `visible` - Modal visibility state
- `image` - Image object with src, name, loading state
- `folderId` - Folder ID
- `onClose` - Callback to close modal
