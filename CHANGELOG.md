# Changelog

All notable changes to this project will be documented in this file.

## [1.7.1] - Deployment Fixes
- Fixed blank page issue on static hosts like `page.gd`. (#rb009)
- Switched to **HashRouter** for 100% compatibility with all static hosting providers.
- Configured relative base paths in Vite for more resilient deployments.

## [1.7.0] - Sound System
- Added **Master Volume** control in Preferences.
- Added **Click Sounds** for buttons and links.
- Added **Navigation Sounds** when entering rooms or moving through the app.
- Added a toggle to disable click sounds specifically.
- All sounds now respect the master volume and mute settings.

## [1.6.1] - Resilient Mode
- Added **Resilient Icons**: Room icons and colors now work even if your Supabase database hasn't been migrated yet. (#rb007)
- Settings will be saved to LocalStorage as a fallback if the database update fails.

## [1.6.0] - Standalone Mode
- Added **Standalone Mode**: The website can now run entirely by itself without Supabase!
- Data is saved to your browser's LocalStorage.
- Real-time chat works across multiple tabs in the same browser using `BroadcastChannel`.
- Automatically activates if Supabase environment variables are missing.

## [1.5.2]
- Fixed "column not found" error by providing migration instructions. (#rb006)
- Migration required: Run the SQL in `supabase/migrations/20260503000000_add_room_icon_and_color.sql` in your Supabase SQL Editor.

## [1.5.1]
- Fixed blank page when entering a room. (#rb005)
- Added bug tracking system to the changelog.

## [1.5.0]
- Added a full Chat Icon System for rooms.
- Customize room icons (e.g., #, %, Smile, Heart) and colors in Room Settings.
- Room icons and colors are now visible in the room list and chat header.

## [1.4.5]
- Added a full Theme System (Sunset, Ocean, Emerald, Rose).
- Fixed theme colors not applying to the animated background. (#rb004)
- Fixed avatar rendering issues in chat and member lists. (#rb003)

## [1.4.4]
- Added extra settings.

## [1.4.3]
- Added User status Checker. 
- Added Visual Effect Settings Menu. 

## [1.3.3]
- Removed Liquid Glass effect 
- Added floating Glass effect to buttons. 
- Added Dark mode/toggleable button. 

## [1.3.2]
- Added Interactive Background. 
- Added Liquid Glass effect. 
- Added Account Profile. 
- Added Room Password. 
- Added Visual Settings to dev. 

## [1.2.2]
- Fixed Interactive Background freeze. (#db001) 

## [1.2.1]
- Added Animated Background. 
- Added Account System. 
- Added New invite system 
- Added interactive background to dev. 
- Added Liquid Glass effect to dev. 
- Added Account profile/passwords to dev. 
- Added User stats system. (online/offline, typing?) 

## [1.1.1]
- Fixed Animated Background. (#rb002) 

## [1.1.0]
- Fixed out of frame. (#rb001) 
- Added dev panel/features. 
- Added Animated Background to dev. 
- Added Account system to dev. 
- Added 6-digit code invite system to dev. 

## [1.0.0]
- Initial release of the Ember chat website. 
- Real-time messaging rooms. 
- Added Changelog 
