import * as Tools from './tools.js';
import { USERS } from './users.js';

const VARS = {};

const setup = async () => {
	Tools.LoadVaribles(VARS);

	if (!VARS['SITE_URL'])
		throw new Error(`SITE_URL not set`);

	while (VARS['SITE_URL'].endsWith('/') === true) {
		VARS['SITE_URL'] = VARS['SITE_URL'].slice(0, -1);
	}

	if (!VARS['DEFAULT_USER'])
		VARS['DEFAULT_USER'] = 'webmaster';
	if (!USERS[VARS['DEFAULT_USER']])
		throw new Error(`The default user does not exist: ${VARS['DEFAULT_USER']}`);

	VARS['API_URL_NODE'] = `${VARS['SITE_URL']}/api/0.3`;
	VARS['API_URL_DRUPAL'] = `${VARS['SITE_URL']}/api`;

	console.log(`Using Node.js API: ${VARS['API_URL_NODE']}`);
	console.log(`Using Drupal API: ${VARS['API_URL_DRUPAL']}`);
	console.log(`Using Default User: ${VARS['DEFAULT_USER']} ${USERS[VARS['DEFAULT_USER']].username}`);

	await Tools.LoginUsers(VARS['API_URL_NODE'], USERS);
}

/**
 * Example report
 * Group users by role
 */
const userRolesReport = (users, report) => {
	// Get all roles being used by users
	const roles = [];
	users.forEach((user) => {
		if (user.roles) {
			user.roles.forEach((role) => {
				if (roles.includes(role) === false)
					roles.push(role);
			});
		}
	});
	roles.sort();

	// For each role make a list of users then put in report 
	roles.forEach((role) => {
		const usersInRole = [];
		users.forEach((user) => {
			if (user.roles && user.roles.includes(role) === true)
				usersInRole.push(user);
		});
		report[`Users in role: ${role}, count: ${usersInRole.length}`] = usersInRole;
	});
}

const main = async () => {

	// Perform setup
	await setup();

	// grab a few varibles
	const defaultUser = USERS[VARS['DEFAULT_USER']];
	const url = VARS['API_URL_NODE'];
	const testId = test.start.toISOString().replace(/:/g, '-');

	//	Just for members/users (leave as is)
	const groupUUID = '30c22118-b669-42f1-9180-9ffc332920e7';
	
	// post or content to make comments against
	const postUUID = '0efbcca4-0ca7-43db-b203-bdc388122054';

	const users = await Tools.GetAll(`${url}/groups/${groupUUID}/members`, defaultUser.headers);

	let lastCommentUUID = postUUID;

	for (let id = 0; id < 1000; ++id) {

		const user = Tools.RandomElement(users, false);

		console.log(user.uuid);

		const data = {
			body: `${testId} ${id} You can tell your ma I moved to Arkansas. Or you can tell your dog to bite my leg. Or tell your brother Cliff who's fist can tell my lips. He never really liked me anyway.`,
			parent_uuid: lastCommentUUID,
			author_uuid: user.uuid,
		};

		let response;

		do {
			response = await Tools.HttpRequest({
				headers: defaultUser.headers,
				method: 'POST',
				url: `${url}/comments`,
				data,
			});
	
			if (response.status !== 201) {
				console.log(JSON.stringify(response.status));
			}
		} while (response.status !== 201);

		if (!Math.floor(Math.random() * 5)) {
			lastCommentUUID = response.data.uuid;
			await Tools.Sleep(2);
		} else {
			lastCommentUUID = postUUID;
		}
		
	}

}


/**
 * Your code here !!!!!!!!
 */
const mainOLD = async () => {

	// Perform setup
	await setup();

	// grab a few varibles
	const defaultUser = USERS[VARS['DEFAULT_USER']];
	const url = VARS['API_URL_NODE'];

	// Get all groups and users at the same time
	let [groups, users] = await Promise.all([
		Tools.GetAll(`${url}/groups/search`, defaultUser.headers),
		Tools.GetAll(`${url}/users/search`, defaultUser.headers),
	]);

	// Report data goes here
	const report = {};

	// Put all groups in report (as they are)
	report['All Groups'] = groups;

	// Run a report on users (function above)
	userRolesReport(users, report);

	// Write the report (you can open in browser)
	await Tools.WriteHtmlReport('report.html', report);


	const testId = (new Date()).toISOString();
	const requestCount = 5;
	const updatedUserUUIDs = [];

	/**
	 * Perform some updates on users (in sequence)
	 */
	for (let requestId = 0; requestId < requestCount; ++requestId) {
		// Take a user out the list at random
		const user = Tools.RandomElement(users, true);
		updatedUserUUIDs.push(user.uuid);

		// Peform API request
		const response = await Tools.HttpRequest({
			headers: defaultUser.headers,
			method: 'PUT',
			url: `${url}/users/${user.uuid}`,
			data: {
				external_id: `${testId}-A-${requestId}`,
			},
		});

		console.log(`sequence ${requestId} ${user.uuid} ${response.took} ${response.status}`);
	}

	/**
	* Perform some updates on users (at the same time)
	*/
	const requestIds = [...Array(requestCount).keys()];
	await Promise.all(requestIds.map(async (requestId) => {

		const user = Tools.RandomElement(users, true);
		updatedUserUUIDs.push(user.uuid);

		console.log(`concurrent ${requestId}`);

		const response = await Tools.HttpRequest({
			headers: defaultUser.headers,
			method: 'PUT',
			url: `${url}/users/${user.uuid}`,
			data: {
				external_id: `${testId}-B-${requestId}`,
			},
		});

		console.log(`concurrent ${requestId} ${user.uuid} ${response.took} ${response.status}`);
	}));

	await Tools.Sleep(3);

	/**
	 * See if they updated
	 */
	users = await Tools.GetAll(`${url}/users/search`, defaultUser.headers);
	users.forEach((user) => {
		if (user.external_id && user.external_id.startsWith(testId)) {
			const index = updatedUserUUIDs.indexOf(user.uuid);
			if (index === -1)
				throw new Error('unexpected user was updated');
			updatedUserUUIDs.splice(index, 1); 
		}

	});
	console.log(`Users not updated: ${JSON.stringify(updatedUserUUIDs)}`);

}

const mainWrap = async () => {
	try {
		await main();
	} catch (error) {
		console.log('############## ERROR ########################');
		console.log(error);
		console.log('#############################################');
		console.log(error.message);
		console.log('#############################################');
	}
};

mainWrap();
