const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const Discord = require('discord.js');
require('dotenv').config();

async function downloadVideo(url) {
    // launch command for linux
    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    // const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // Add request listener
    page.on('request', interceptedRequest => {
        const url = interceptedRequest.url();

        // If the request URL matches the pattern of a video file
        if (url.startsWith('https://scontent')) {
            videoUrl = url;
        }

        interceptedRequest.continue();
    });

    // Navigate to the page containing the video
    try {
        await Promise.all([
            page.goto(url, { timeout: 60000 }),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);
    } catch (e) {
        if (e instanceof puppeteer.errors.TimeoutError) {
            // Handle the timeout how you want (e.g., by skipping this URL, retrying, logging, etc.)
            console.log("Timeout error, skipping this URL...");
        } else {
            throw e;  // For non-timeout errors, still throw the error so you can see it
        }
    }

    // Wait for the video element to be loaded
    try {
        // Try to find the video element
        await page.waitForSelector('video', { timeout: 60000 });

        // Code to process the video goes here...
    } catch (error) {
        if (error instanceof puppeteer.errors.TimeoutError) {
            // If the video element wasn't found within the timeout, send a message
            console.log('Video element not found');
            // Or use your bot's messaging function to send a message to the user
        } else {
            // If some other error occurred, rethrow it
            throw error;
        }
    }

    // Extract video URL from 'src' attribute
    // const videoUrl = await page.evaluate(() => {
    //     const videoElement = document.querySelector('video');
    //     return videoElement ? videoElement.getAttribute('src') : null;
    // });

    if (!videoUrl) {
        console.log('No video URL found');
        return;
    }

    console.log(`Downloading video from: ${videoUrl}`);

    // Download the video
    const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    // Create a write stream to save the video to a file
    const path = 'video.mp4';
    const writer = fs.createWriteStream(path);

    // Handle errors when creating the write stream
    writer.on('error', (err) => {
        console.error(`Error occurred while writing to the file: ${err}`);
    });

    // Pipe the video stream into the write stream
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    console.log('Video downloaded successfully. Now uploading to Discord.');

    await browser.close();
}

function extractInstagramUrl(text) {
    // a basic example that just finds the first URL in the text
    const words = text.split(' ');
    return words.find(word => word.startsWith('https://www.instagram.com/'));
}

// Initialize the client with your intents
const GUILDS_AND_GUILD_MESSAGES_INTENTS =
    (1 << 0) +  // GUILDS
    (1 << 9) +   // GUILD_MESSAGES
    (1 << 15); // MESSAGE_CONTENT

const client = new Discord.Client({ intents: GUILDS_AND_GUILD_MESSAGES_INTENTS });

client.once('ready', () => {
    console.log('Discord bot is ready');
});

client.on('messageCreate', async message => {
    console.log(`Received a message from ${message.author.tag}: ${message.content}`);
    console.log('message: ' + message);

    // Check if the message is not from a bot and contains an Instagram URL
    if (!message.author.bot && message.content.includes('instagram.com')) {
        // Extract the Instagram URL
        const url = extractInstagramUrl(message.content);
        console.log(`Extracted URL: ${url}`);

        // Download the video
        await downloadVideo(url);

        // Then send the video to the same channel the message was in
        if (message.channel.type === 0) {
            try {
                await message.channel.send({
                    content: `Can you believe ${message.author} just tried to make you click a link? Here's the video:`,
                    files: [{
                        attachment: 'video.mp4',
                        name: 'video.mp4'
                    }]
                });
                console.log('Video uploaded successfully to Discord.');
            } catch (error) {
                console.error('Error occurred while reading from the file: ' + error);
            }

            if (fs.existsSync('video.mp4')) {
                try {
                    fs.unlinkSync('video.mp4');
                } catch (error) {
                    console.error('Error occurred while deleting the file: ' + error);
                }
            }
        } else {
            console.error('Target channel is not a text channel.');
        }
    } else {
        console.log(`Message "${message.content}" does not include an Instagram link`)
    }
});


client.login(process.env.DISCORD_BOT_TOKEN);