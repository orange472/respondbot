# RespondBot

RespondBot is a Slack app that automatically notifies users when there are messages that haven't been responded to. Click [here](https://k5yov2sr42.execute-api.us-east-1.amazonaws.com/dev/slack/install) or the button below to add RespondBot to your Slack workspace!

<a href="https://k5yov2sr42.execute-api.us-east-1.amazonaws.com/dev/slack/install"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>

## Custom Deployment

### Install modules

To install the required modules, run

```sh
npm install
```

### Create Slack App

To make this app your own, you will first need to go to [the Slack API](https://api.slack.com/apps) and create a new app. After creation, go to the _Basic Information_ tab in your app's _Settings_ menu. Here, you can retrieve your app's _Signing Secret_, _Client ID_, and _Client Secret_. Export these values to environment variables.

Note: If you only want to use RespondBot in a single workspace, you can ignore these fields and instead head over to the _Install App_ tab to grab your _Bot User OAuth Token_. You will need to add this token to your ExpressReceiver in `app.js` while getting rid of all other fields except for your signing secret, as well as adding an environment variable to your `serverless.yml` file.

### Firebase

I am using Firebase as my storage solution. You will need to create your own Firebase project, generate a service account JSON file, and then provide the path to your file as an environment variable. I personally created a `config` folder in the root directory and placed my file there.

### Deploying to AWS Lambda

Finally, you will need to set up AWS Lambda and Serverless. Follow [this guide](https://slack.dev/bolt-js/deployments/aws-lambda) to set up AWS Lambda and the Serverless framework, before finally running

```sh
serverless deploy
```

Paste the endpoints given in your Slack app directory (for example, the endpoint ending with `.../oauth/callback` should be your app's redirect URI for OAuth, `.../slack/events` for commands and events).
