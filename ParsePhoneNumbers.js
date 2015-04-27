// Constants for directory names
const RAW_TEXTS_DIR = 'raw_texts';
const PARSED_TEXT_DIR = 'parsed_texts';
const PHONE_NUMBER_DB_FILENAME = 'phoneNumbers.json'


var	fs = require('fs'),
	readline = require('readline'),
	Papa = require('papaparse');


// Create a global phone number cache
var phoneNumbers = {};

// Setup the IO system
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

/***************
 * MAIN SCRIPT *
 ***************/

// Load the phone number DB
try {
	var phoneNumbersString = fs.readFileSync(PHONE_NUMBER_DB_FILENAME, {encoding: 'utf-8'});
	phoneNumbers = JSON.parse(phoneNumbersString);
}
catch(err) {
	console.error("Error loading the phone number database: ", err);
}

// Open all .csv files in the raw directory
console.log("Reading directory...")
fs.readdir(RAW_TEXTS_DIR, function(err, files) {
	if(err)
	{
		console.err("Error reading the raw_texts directory", err);
		return;
	}
	// Filter for just the csv files
	files.filter(function(file) { 
		return file.substr(-4) === '.csv';
	})
	// Make the file a full path
	.map(function(filename) {
		return RAW_TEXTS_DIR + '/' + filename;
	})
	// Read each file
	.forEach(function(file) {
		fs.readFile(file, 'utf-8', function(err, contents) {
			// Parse the data
			var parsedData = handleCSV(contents);
			// Save the parsed CSV
			var outFilename = file.replace(RAW_TEXTS_DIR, PARSED_TEXT_DIR);
			saveCSV(parsedData, outFilename);
			// Save the updated number database
			savePhoneNumbers();
		});
	});
});


/**
 * Takes in a data object and saves it as a CSV with the 
 * given filename in the output directory
 */
function saveCSV(data, filename) {
	// Unparse the object (turn it in to a CSV)
	var csv = Papa.unparse(data, {quotes: true});

	fs.writeFile(filename, csv, function(err) {
		if(err)
		{
			console.error("Error saving file: " + filename, err);
		}
		else
		{
			console.log("Saved file: " + filename);
		}
	});
}


/**
 * Saves the phone number database
 */
function savePhoneNumbers() {
	var numbers = JSON.stringify(phoneNumbers);

	fs.writeFile(PHONE_NUMBER_DB_FILENAME, numbers, function(err) {
		if(err)
		{
			console.error("Error saving phone number database", err);
		}
	});
}


/***********
 * HELPERS *
 ***********/

/**
 * Takes in a CSV file as a string and returns
 * a the parsed version of the CSV, asking for
 * user input along the way as needed
 * Returns the CSV with senderGender and recipientGender fields
 */
function handleCSV(contents) {
	// Parse the CSV into an object with PapaParse
	var parsed = Papa.parse(contents, {header: true});

	// Keep track of the phone number associated with this conversation
	// TODO base this on the input variables
	var threadOwner = {
		number: '+14073418477',
		gender: 'm'
	}

	var participants = [];

	// parsed.data is an array of the parsed rows, stored as objects keyed by the CSV headers
	// So lets loop through each text in the data and process it

	// First filter out all invalid texts
	var cleanData = parsed.data.filter(function(text) {
		if(text['#sender'] == '' || text['text'] == '')
		{
			// Skip these invalid texts
			return false;
		}
		else
		{
			return true;
		}
	});

	// Set the parsed data to be the clean data
	parsed.data = cleanData;

	parsed.data.forEach(function(text) {
		// Make sure the sender and text fields are set
		if(text['#sender'] == '' || text['text'] == '')
		{
			// Skip these invalid texts
			return;
		}

		// // Was this text sent by the thread owner?
		// if(text['#sender'] === threadOwner.number)
		// {

		// }

		// // Find out if this number is male or female
		// var senderGender = getGenderOfNumber(text['#sender']);


		// Go through each text and find out who the thread participants are

		// If this sender isn't yet in the list of partipants
		if(participants.indexOf(text['#sender']) == -1)
		{
			// Add them to the participants list
			participants.push(text['#sender']);
		}

	});

	// Make sure there were exactly two participants
	if(participants.length != 2) {
		console.error("Error: number of participants in this conversation is not 2. They were:");
		console.error(participants);
		console.error("Skipping this conversation.");
		return;
	}

	// For each text, add a recipient field
	for(var i = 0; i < parsed.data.length; i++)
	{
		var data = parsed.data[i];
		// If this is the first participant sending, then the reciever is the second participant
		if(participants.indexOf(data['#sender']) == 0)
		{
			data['#recipient'] = participants[1]
		}
		else if (participants.indexOf(data['#sender']) == 1)
		{
			data['#recipient'] = participants[0]
		}
		else
		{
			console.error("Error: the sender wasn't a valid conversation participant. Something went very wrong.");
		}
	}

	// Use the sender and recipient numbers to add genders
	for(var i = 0; i < parsed.data.length; i++)
	{
		var data = parsed.data[i];

		// Get the gender of the sender in a sync fashion
		// var done = false;
		// var gender = null;
		// getGenderOfNumber(data['#sender']);
		// while(!done) {
		// 	require('deasync').runLoopOnce();
		// }
		// console.log("DONE");
		// data['senderGender'] = gender;

		// done = false;
		// gender = null;
		// getGenderOfNumber(data['#recipient']);
		// while(!done) {
		// 	require('deasync').runLoopOnce();
		// }
		// data['recipientGender'] = gender;

		data['senderGender'] = getGenderOfNumber(data['#sender']);
		data['recipientGender'] = getGenderOfNumber(data['#recipient']);
	}

	// participants.forEach(function(number) {
	// 	// Is this number in the cache?

	// 	// Otherwise, ask who's number this is
	// 	getGenderOfNumber(number, function(err, gender) {
	// 		if(err)
	// 		{
	// 			console.error("Error getting the gender of this number: " + number, err);
	// 		}


	// 	});
	// });

	// Return the parsed data
	return parsed.data;
}


/**
 * Finds the gender of the given number
 * If not in cache, asks the user for the gender
 */
function getGenderOfNumber(number) {
	// Is this number in the cahce?
	if(phoneNumbers[number])
	{
		return phoneNumbers[number];
	}

	// Else ask the user
	var gender_answer = null;

	rl.question("What is the gender (m/f) of " + number + ": ", function(answer) {
		// Did they give an appropiate answer?
		answer = answer.trim();
		if(answer != 'm' && answer != 'f')
		{
			// Try again
			console.error("Please enter m or f.");
			console.error(answer);
			getGenderOfNumber(number);
		}
		else
		{
			// Add the gender to the cache
			phoneNumbers[number] = answer;
			// Set the gender up the function call chain
			gender_answer = answer;
		}
	});

	// Wait on the user to respond
	while(!gender_answer) {
		require('deasync').runLoopOnce();
	}

	return gender_answer;
}

// FIN