# The Legendary Cloud Guardian
![Cloud Guardian Logo](/images/cloud-guardian.png)
## In a world torn apart by cyberattacks, a lone guardian takes to the clouds in order to fight back. That guardian is you.

### This portion is the backend server for the Legendary Cloud Guardian
This backend server runs on NodeJS written in TypeScript. TypeORM is used to relate object to the database table. 

An SQLite database is used on local installations, but this server is made with Google Cloud in mind, and supports **Google Cloud MySQL** as an alternative database store.

Images are stored only as links locally, but this server supports downloading and redirection of images directly to **Google Storage Buckets** from a provided image URL.

This app can run locally or from **Google App Engine.**

To see the frontend server, please follow Gabriel Beltran's repository: [Cloud Guardian Frontend Server](https://github.com/otakuweebster/crimson-nimbus-frontend)


# Contents
[Description](#description)
[Gameplay](#gameplay)
[Google Cloud Elements](#google-cloud-elements)
[Routes](#routes)


# Description
The Legendary Cloud Guardian is a game inspired by a recent Tik Tok trend, wherein people use a filter shows a random character from a pool and they use the characters shown to create a narrative.
Some examples of this trend include:
- Building a team from the characters that appear
- Speculating on how battles might play out between the characters that appear
And, as this game depicts:
- **Drafting different attributes from the characters that appear to build the strongest character possible.**

![Login Page](/images/login-page.png)
This game uses Discord OAuth as a login scheme, so a Discord account is required to log in.

# Gameplay
Gameplay is split into a few different parts:
1) Character Creation
2) Character Battles
3) Character Rerolls / Stat Modification
4) High scores from the most powerful characters
![Main Menu Page](/images/main-menu.png)
### Character Creation
By clicking the **NEW CHARACTER** button on the main menu, you are taken to a character creation screen.
In this screen you will see two textboxes and 8 buttons

![New Character Screen](/images/new-character.png)

The textboxes are to contain:
1) Character Name (1-12 Characters)
2) URL linking to an image of this character. (This URL must link to an image with a mimetype of either image/jpg, image/jpeg, or image/png)

The buttons are labelled with:
1) Height
2) Weight
3) Strength
4) Power
5) Combat
6) Speed
7) Durability
8) Intelligence

Beside the button you will see a character and their stats.
For each character in the list, you can choose one of their stats to add to your character by clicking the corresponding button.
You may only pick one stat from each character and cannot change a stat in this pool after it is selected.

![New Character Page with fields filled out](/images/new-character-filled.png)

After all stats are selected and your character is given a name and an image URL, click **Transmit New User** to add them to the character database.

![Character successfully transmitted](/images/character-transmitted.png)

### Character Battles
After a character has been created, they can be used in battle. 

Click the **FIGHT** button and you will be taken to the character select screen.

![Character Select Screen](/images/character-select.png)

Here you will find a list of characters that you have created and that are able to fight.

Characters can fight until they are killed, at which point they will no longer be visible on this page.

To use a character in a fight, click their image on the left side and confirm that they appear on the right side. Click **LET 'ER RIP!** to begin the fight.

---------------------


# Google Cloud Elements
While it is completely usable offline, The Legendary Cloud Guardian is created with Google Cloud Deployment in mind. To take advantage of these features, the following considerations are to be made:

## Cloud SQL 
Google's cloud offerings include SQL databases, which are able to be used in place of this server's SQLite database.

##### Creating an SQL Instance
To set up Cloud SQL, navigate to the Cloud SQL page in the Google Cloud console, and click Create Instance.

![SQL Search results on Google Cloud Console](/images/sql-search.png)

![SQL Instance Button on Cloud Console](/images/sql-instance.png)

In the instance setup process, choose MySQL as your database engine.

![Selecting MySQL as Database Engine](/images/sql-Engine.png)

If prompted to enable Google Compute Engine API, do so.

When creating a MySQL instance, you will be asked to provide an **Instance ID** and a password for the root user. Keep a note of these values, as they will be necessary later.

For other options in the MySQL instance page, leave the settings as their default and click Create Instance. Note that creating the instance may take a few minutes.

Once the instance is created, navigate to its Overview Page. Here you will see its **Public IP**. Keep a note of this value, as it will be necessary later.

##### Configuring SQL Networking
Next, navigate to the SQL > Connections > Networking tab of this instance. Here you are able to add a new **Authorized Network**. You can add your own public IP to connect to this database from a locally hosted server, or you can add CIDR notation to allow a range of IP Addresses. (Allow connections from 0.0.0.0/0 to allow all public IP addresses).

##### Adding an SQL User
Navigate to SQL > Users and click **Add a User Account**

Leave authentication as built-in authentication and set a **username** and **password**. Make a note of these, as they will be necessary later.
Optionally, you can add a specific IP / IP Address range to restrict which hosts can log in.

##### Creating a Database
Navigate to SQL > Databases. Click the **Create Database** button. Enter your **Database Name** and click create. Make a note of this database name.

#### Cloud SQL Environment Variables
To take advantage of this SQL server, make sure your server's IP is in the authorized range, and then add the following environment variables to your backend server:
```
NODE_ENV=production
DB_NAME=(the name of the database you created in the previous step)
DB_HOST=(the public IP of your SQL instance)
DB_PORT=3306
DB_USER=(the username of the database user you created)
DB_PASS=(the password of the database user you created)
DB_TYPE=mysql
```


## Google Storage Buckets

This server stores character images as image URLs. 
If this server is running with a Cloud Storage Bucket assigned to it, images can be downloaded from the provided URLs and then stored as files in Google Storage for URL uniformity and decreased complexity, as images would only ever need to be downloaded from one server location.

#### Cloud Console Setup
To implement Cloud Storage Buckets, navigate to the Cloud Storage product in the Google Cloud console. Click the **Create** button on the **Buckets** page.

Give your bucket a **Name**, and make note of the name provided, as it will be necessary later.
In the **Choose how to control access to objects** section, clear the checkbox named **Enforce public access prevention on this bucket**

Leave all other settings as default, and click the **Create** button.

When this bucket is created, you will be taken to its **Bucket details** page. Click the **Permissions** tab and click the **Grant Access** button.

In the **New principals** textbox, enter **allUsers**.
In the **Select a role** dropdown box, select **Storage Legacy Object Reader**, found in the **Cloud Storage Legacy** section.

#### Server Configuration
##### Environment Variables
To enable buckets on the server, add the following environment variables to your backend server:
```
BUCKET=(the name of the bucket you created)
```

##### Google Sign-in
After the environment variables are added, access a terminal in your server directory and sign into Google using the following command:
```
gcloud auth application-default login
```
Follow the on-screen instructions for the Google sign-in process.

## Google App Engine

This server can be deployed to Google App Engine.

To do so, search for and select App Engine from the Google Console and click **Create Application**.

Leave region settings as their default and select **Compute Engine Default Service Account** or any other service account you would like to deploy with. Click next and wait for the Application to be created.

Set the language to Node.js and leave other settings as default. 

Run the Cloud SDK from your local terminal (If you haven't already downloaded it, download and install it) and run the following command:
```
gcloud init
```

Follow any steps or logins that Google guides you through.

Using the terminal, navigate to the directory holding the server and run the following command:
```
gcloud app deploy
```
Take note of the **target url** and **target service account**.
If necessary, create a file titled "app.yaml" in the server directory. Fill it with the following information:
```yaml
runtime: nodejs18

automatic_scaling:
	max_instances: 1

env_variables:
	AMCLOUD: "gcloud"
	CLIENTID: (the target service account provided earlier)
	APPURL: (the target url provided earlier)
	(add any environment variables you created earlier using this same format)
```

Save this file, and then launch a new terminal. Navigate it to the server directory and run the following command:
```
tsc
```

When this command is finished executing. return to your first terminal and enter Y to continue.

# Routes

All routes require a header of
```
Authorization: Bearer (Discord Auth Token with Identity scope)
```

## POST /login

Requires no body or other parameters.

This route uses the provided Authorization header to query Discord's API to get the current user's information added to the database.

Can be used to:
- Add new users to the database
- Update a user's information (such as if they change their profile picture)
- Fetch other information about the user, such as their high score

Returns: DiscordUser object of the current User


## GET /characters/

Optional query parameters:
``` 
where: Values to search with (can be used to filter results by passing in a user's uID or user name)

limit: Maximum number of characters to return (default is 100)

sortby: Field to sort by (can be id, creator, creator.userName, wins, isActive, or name)

sortorder: Order to sort by (ascending by default; can be set to descending by sending DESC, DESCENDING, or D)
```
Used to fetch an array of user-created characters from the database.

Returns: CustomCharacter array matching the requested parameters


## GET /characters/npc/

Optional query parameters:
```
size: size of image links to return (defaults to md; allowed sizes are xs, sm, md, lg)
```

This route returns all NPC characters. To save work on the frontend machine, it concatenates all images to the requested size.

Returns: Character Array


## GET /characters/user/

Optional query parameters:
```
sort: field to sort by (defaults to isActive)
```

This route returns all of a user's characters, in descending order of the sort field.

This route is most often used to return a list of characters that a user may use to fight, so it returns active characters before inactive characters as its default state

Returns: CustomCharacter Array created by requester


## GET /characters/:id

Returns the character matching the requested ID
Returns 404 if character is not found

Returns: CustomCharacter


## GET /character/newroll/

Returns a fresh set of characters to be used in character creation and stat drafting

Returns: Character Array of size 8


## PUT /character/modify/:id

Route used to modify a character's image or name

This route can only be used if the requester is the creator of the character of specified ID

If no character matches the specified ID, 404 is returned.

Required arguments:
```
Body with { name: characterName, url: imageURL }
```

Returns: CustomCharacter with changes made


## POST /character/new

This route is used to add new characters to the database

Required arguments:
```
Body with:
{
name: characterName 
url: imageURL
height: number (representing height in cm)
weight: number (representing weight in kg)
speed: number (0-100)
strength: number (0-100)
power: number (0-100)
combat: number (0-100)
intelligence: number (0-100)
durability: number (0-100)
}
```

If Cloud Storage Buckets are configured, this route will download the image file from the provided URL and save it to the Google Storage Bucket. The character's URL will then be changed to the bucket image URL.
If the mimetype of the provided image is not one of image/jpg, image/jpeg, or image/png, this action is skipped and the image url is saved as is.

Character is saved, with wins set to 0 and isActive set to true.

Returns: CustomCharacter


## PUT /character/reroll

Required query parameters:
```
charID: ID of the character to reroll
stat: stat to reroll (see options below)
```

Stat options:
```
1 = height
2 = weight
3 = intelligence
4 = strength
5 = speed
6 = durability
7 = combat
8 = power
```

This route can only be executed on characters which the requester has created.

The specified character has the specified stat value replaced with a random character.

The random character is returned, as well as the modified custom character

Returns: { c1: CustomCharacter, c2: Character }


## PUT /character/battle/:charID

Required parameters:
```
charID: id of character
```

This route can only be called by the creator of the specified character

This route finds the specified character and uses them to battle with a random character.

The battle results are determined by calculating Value Points, which are a numeric evaluation of a character's abilities based on their stats.

This route updates the character's wins if they win, or makes them inactive if they lose.

Returns: { 
	c1: CustomCharacter, 
	c2: Character, 
	c1VP: CustomCharacter's Value Points, 
	c2VP: Opponent's Value Points, 
	win: boolean (true if your character wins)
}

## PUT /characters/import/:importURL

Required parameters: URL to import character data from, as a URI Encoded Component. The built-in data source is accessible by calling this route as:
```
/characters/import/%2E%2E%2F%2E%2E%2Fherodata%2Ejson
```

This route is used to load NPC characters into the database, and is only usable by the Database Admin.

The Database Admin is determined by the following environment variable:
```
ADMIN_USER_ID=(Admin's Discord ID)
```

This route should be called at least once when initializing a new database in order to create NPC characters.

Calling this route more than once will result in the Character table being cleared and reloaded with provided data

Returns:
```js
{ 
	charactersAdded: number,
	unprocessableCharacters: [ 
		{ 
			character,
			violations: [{ValidationErrors}] 
		} 
	] 
}
```

