# Welcome to Ember!

Ember is a Free Chat website. You can create chat rooms and invite other people and start chatting! You can also share photos and files.

### System Explained

 First thing you see when entering the [Website](ember-cr.github.io) is going to a welcome message giving you the option to Get Started or I have an invite. Both of them makes you sign in or create an account. Currently, the google signin method doesn't work, we will fix that soon. After you sign in, you can create a room or join one. We are planning to make a Global Chat rooms that you can optionally join. When you create or join a room, you can see that there is a member list that you can see who is in the chat room.
 Now, inside the chat room, the member list has a list of users inside the chat. There should be a green or a gray dot at there profile picture that means green=online, gray=offline. 
 Back at the main screen (with the list of chat rooms) you can customize your profile by clicking on your profile-> Edit Profile. You can also choose your theme and setting in the Appearance/Sound list (gear-like icon).

 ### That is pretty much it! Have a great time Chatting!

 # Recent Changes:
 ## [1.7.2] - Global Chat
- Added **Global Chat**: A community room that anyone can optionally join.
- New **Join Global Chat** prompt on the rooms list page for easy access.
- Added a "Global" badge in the chat header to identify the community room.
- Restricted deletion of the Global Chat room to ensure it stays available for everyone.
- Added support for persistent community rooms via the `is_global` database flag.
- **Migration Required**: Run the SQL in `supabase/migrations/20260506000000_add_global_flag.sql` in your Supabase SQL Editor to enable Global Chat features.
- Added **Resilient Mode** for global chat: The app will continue to work even if the database migration hasn't been applied yet
 
 If you have any questions, leave a email! 
 jameshwang0228@outlook.com
