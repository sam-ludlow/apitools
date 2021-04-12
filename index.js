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

/**
 * Your code here !!!!!!!!
 */
const main = async () => {

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
	const requestCount = 7;
	const updatedUserUUIDs = [];

	/**
	 * Perform some updates on users (in sequence)
	 */
	for (let requestId = 0; requestId < requestCount; ++requestId) {
		// Take a user out the list at random
		const user = Tools.RandomElement(users, true);
		updatedUserUUIDs.push(user.uuid);

		const start = new Date();

		// Peform API request
		const response = await Tools.HttpRequest({
			headers: defaultUser.headers,
			method: 'PUT',
			url: `${url}/users/${user.uuid}`,
			data: {
				external_id: testId,
			},
		});
		const took = ((new Date()) - start) / 1000;

		console.log(`sequence ${requestId} ${user.uuid} ${took} ${response.status}`);
	}

	/**
	* Perform some updates on users (at the same time)
	*/
	const requestIds = [...Array(requestCount).keys()];
	await Promise.all(requestIds.map(async (requestId) => {

		const user = Tools.RandomElement(users, true);
		updatedUserUUIDs.push(user.uuid);

		console.log(`concurrent ${requestId}`);

		const start = new Date();

		const response = await Tools.HttpRequest({
			headers: defaultUser.headers,
			method: 'PUT',
			url: `${url}/users/${user.uuid}`,
			data: {
				external_id: testId,
			},
		});
		const took = ((new Date()) - start) / 1000;

		console.log(`concurrent ${requestId} ${user.uuid} ${took} ${response.status}`);
	}));

	await Tools.Sleep(10);

	/**
	 * See if they updated
	 */
	users = await Tools.GetAll(`${url}/users/search`, defaultUser.headers);
	users.forEach((user) => {
		if (user.external_id === testId) {
			const index = updatedUserUUIDs.indexOf(user.uuid);
			if (index === -1)
				throw new Error('unexpected user was updated');
			updatedUserUUIDs.splice(index, 1); 
		}

	});
	console.log(`Users not updated: ${JSON.stringify(updatedUserUUIDs)}`);

}

main();
