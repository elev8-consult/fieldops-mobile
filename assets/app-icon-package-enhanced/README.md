# App icon package

Generated from the supplied navy-and-lime growth logo.

## iOS

Drag `ios/AppIcon.appiconset` into the Xcode asset catalog, or replace the existing
`AppIcon.appiconset`. The PNG files are square RGB images without transparency or
pre-rounded corners, as required by Apple.

## Android

Copy the contents of `android/res` into the app module's `src/main/res` folder.
The package includes legacy density icons, round icons, and Android 8.0+ adaptive
icon resources. The adaptive icon uses a white background and a padded transparent
foreground to keep the arrow inside Android's safe area.

## Master

`master/app-icon-4096.png` is the enhanced high-resolution square source used for
all exports. A conventional 1024px master is included alongside it.
