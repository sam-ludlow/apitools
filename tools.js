import fs from 'fs';
import http from "http";
import https from "https";

const _HtmlStyle =
	"body {" +
	" font-family: sans-serif;" +
	" font-size: small;" +
	" background-color: #9BBEAF;" +
	"}" +
	"hr {" +
	" color: #4BB88B;" +
	" background-color: #4BB88B;" +
	" height: 6px;" +
	" border: none;" +
	" padding-left: 0px;" +
	"}" +
	"table {" +
	" border-collapse: collapse;" +
	"}" +
	"th, td {" +
	" padding: 2px;" +
	" text-align: left;" +
	" font-size: small;" +
	"}" +
	"table, th, td {" +
	" border: 1px solid black;" +
	"}" +
	"th {" +
	" background-color: #4BB88B;" +
	" color: white;" +
	"}" +
	"tr:nth-child(even) {" +
	" background-color: #AFCBBF;" +
	"}" +
	"";

export const LoadVaribles = (varibles) => {
	Object.keys(process.env).forEach((envKey) => {
		varibles[envKey] = process.env[envKey];
	});

	process.argv.forEach((arg) => {
		if (arg.includes('=') === true) {
			const pair = arg.split('=');
			if (pair.length === 2)
				varibles[pair[0]] = pair[1];
		}
	});
}

export const Sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

export const HttpRequest = async ({
	url,
	method,
	headers,
	data,
}) => {
	url = new URL(url);

	const options = {
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port || undefined,
		path: url.pathname,
		method,
		headers,
	};

	if (url.search)
		options.path += url.search;

	if (data && typeof data === 'object') {
		if (!options.headers) options.headers = {};
		options.headers['content-type'] = 'application/json';

		data = JSON.stringify(data);
	}

	let client = options.protocol === 'http:' ? http : https;

	return new Promise((resolve, reject) => {

		const start = new Date();
		
		const request = client.request(options, (response) => {
			let responseData = '';

			response.on('data', (chunk) => {
				responseData += chunk;
			});

			response.on('end', () => {
				const contentType = response.headers['content-type'] || undefined;
				if (contentType && contentType.startsWith('application/json') === true)
					responseData = JSON.parse(responseData);

				resolve({
					status: response.statusCode,
					statusText: response.statusMessage,
					headers: response.headers,
					data: responseData,
					took: ((new Date()) - start) / 1000,
				});
			});
		});
		request.on('error', error => {
			reject(error);
		});

		if (data)
			request.write(data);

		request.end();
	});
}

export const LoginUsers = async (url, users) => {
	return Promise.all(Object.keys(users).map(async (userKey) => {
		const user = users[userKey];

		if (!user.username || !user.password)
			throw new Error(`User credentials missing: ${userKey}`);

		let response;

		response = await HttpRequest({
			method: 'POST',
			url: `${url}/sessions/login`,
			data: user,
		});
		if (response.status !== 200)
			throw new Error(`Login failed ${userKey} ${response.status} ${response.statusText} ${JSON.stringify(response.data)}`);

		delete user.password;

		const setCookies = response.headers['set-cookie'];
		if (setCookies && setCookies.length)
			user.headers = { 'cookie': setCookies.join('; ') };

		response = await HttpRequest({
			method: 'GET',
			url: `${url}/sessions/token`,
			headers: user.headers,
		});
		if (response.status !== 200)
			throw new Error(`Get token failed ${response.status} ${response.statusText}`);
		user.headers['x-csrf-token'] = response.data.token;

		response = await HttpRequest({
			method: 'GET',
			url: `${url}/users/me`,
			headers: user.headers,
		});
		if (response.status !== 200)
			throw new Error(`Get users me failed ${response.status} ${response.statusText}`);
		user.me = response.data;
	}));
}

export const GetAll = async (path, headers, maxResults) => {
	const separator = path.indexOf('?') === -1 ? '?' : '&';
	const limit = 100;
	let offset = 0;
	let results = [];
	let response;
	do {
		const url = `${path}${separator}limit=${limit}&offset=${offset}`;

		response = await HttpRequest({
			method: 'GET',
			url,
			headers,
		});

		if (response.status !== 200)
			throw new Error(`GetAll bad status ${response.status}`);

		results = results.concat(response.data.results);
		offset += limit;
	} while (
		response.data.count >= limit
		&& response.data.results.length > 0
		&& (!maxResults || results.length < maxResults));
	return results;
};

export const RandomElement = (array, remove) => {
	if (array.length === 0)
		throw new Error('Array empty');
	const index = Math.floor(Math.random() * array.length);
	const result = array[index];
	if (remove === true)
		array.splice(index, 1);
	return result;
}

export const HtmlEncode = (html) => html.replace(/[&<>'"]/g,
	tag => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		"'": '&#39;',
		'"': '&quot;'
	}[tag]));

export const RenderHtmlTable = (data) => {
	if (typeof data !== 'object')
		return HtmlEncode(JSON.stringify(data));

	if (Array.isArray(data) === false) {
		data = [data];
	}

	if (data.length === 0)
		return '[]';

	if (typeof data[0] !== 'object')
		return HtmlEncode(JSON.stringify(data));

	const columnNames = [];
	data.forEach((row) => {
		Object.keys(row).forEach(columnName => {
			if (columnNames.includes(columnName) === false)
				columnNames.push(columnName);
		});
	});

	let table = '';

	table += '<table>';
	table += '<tr>';
	columnNames.forEach(columnName => {
		table += `<th>${columnName}</th>`;
	});
	table += '</tr>';

	data.forEach((row) => {
		table += '<tr>';
		columnNames.forEach(columnName => {
			let value = '';
			if (row[columnName] !== undefined)
				value = RenderHtmlTable(row[columnName]);

			table += `<td>${value}</td>`;
		});
		table += '</tr>';
	});

	table += '</table>';

	return table;
};

export const WriteFile = async (filename, contents) => {
	fs.writeFileSync(filename, contents);
}

export const WriteHtmlReport = async (filename, report) => {
	let html = `<html><head><style type="text/css">${_HtmlStyle}</style></head><body>`;

	Object.keys(report).forEach((tableName) => {
		html += `<h2>${tableName}</h2>`;
		html += RenderHtmlTable(report[tableName]);
		html += '<hr />';
	});

	html += '</body></html>';

	await WriteFile(filename, html);

	console.log(`REPORT SAVED: ${filename}`);
}
