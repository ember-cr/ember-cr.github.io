# Welcome to Ember!

Ember is a Free Chat website. You can create chat rooms and invite other people and start chatting! You can also share photos and files.

### System Explained

 First thing you see when entering the [Website](ember-cr.github.io) is going to a welcome message giving you the option to Get Started or I have an invite. Both of them makes you sign in or create an account. Currently, the google signin method doesn't work, we will fix that soon. After you sign in, you can create a room or join one. We are planning to make a Global Chat rooms that you can optionally join. When you create or join a room, you can see that there is a member list that you can see who is in the chat room.
 Now, inside the chat room, the member list has a list of users inside the chat. There should be a green or a gray dot at there profile picture that means green=online, gray=offline. 
 Back at the main screen (with the list of chat rooms) you can customize your profile by clicking on your profile-> Edit Profile. You can also choose your theme and setting in the Appearance/Sound list (gear-like icon).

 ### That is pretty much it! Have a great time Chatting!

 # Recent Changes:
## [1.9.0] - Standalone Mode Toggle
- Added a manual **Standalone Mode** toggle in the Settings Menu.
- Standalone Mode allows the website to run entirely without Supabase, saving all data (rooms, messages, profiles) to your browser's LocalStorage.
- Added a **Standalone Mode badge** in the navigation bar when running locally.
- Real-time chat still works across tabs in the same browser using `BroadcastChannel`.
- Improved error resilience and added automatic fallbacks for missing database columns.

We are going to pause the updates for a while, but still say tuned!
 
 If you have any questions, leave a email! 
 jameshwang0228@outlook.com
