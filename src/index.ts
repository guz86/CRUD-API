import http, { IncomingMessage, ServerResponse } from 'node:http';
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);

interface User {
    id: string;
    name: string;
    age: number;
    hobbies: string[];
}

interface CreateUserRequest {
    name: string;
    age: number;
    hobbies: string[];
}

interface UpdateUserRequest {
    name?: string;
    age?: number;
    hobbies?: string[];
}

const users: User[] = [];

const sendResponse = (res: ServerResponse, statusCode: number, data: object): void => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const isValidUUID = (id: string): boolean => {
    return validateUUID(id);
};

const getAllUsers = (res: ServerResponse): void => {
    sendResponse(res, 200, users);
};

const getUserById = (res: ServerResponse, userId: string): void => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format' });
        return;
    }

    const user = users.find((u) => u.id === userId);
    if (!user) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
    } else {
        sendResponse(res, 200, user);
    }
};

const validateUserData = (data: CreateUserRequest): boolean => {
    const { name, age, hobbies } = data;
    if (typeof name !== 'string' || name.trim() === '') {
        return false;
    }
    if (typeof age !== 'number' || Number.isNaN(age)) {
        return false;
    }
    if (!Array.isArray(hobbies) || !hobbies.every(hobby => typeof hobby === 'string')) {
        return false;
    }
    return true;
};

const createUser = (res: ServerResponse, body: CreateUserRequest): void => {
    if (!validateUserData(body)) {
        sendResponse(res, 400, { message: 'Invalid user data.' });
        return;
    }

    const newUser: User = {
        id: uuidv4(),
        name: body.name,
        age: body.age,
        hobbies: body.hobbies,
    };

    users.push(newUser);
    sendResponse(res, 201, newUser);
};

const updateUser = (res: ServerResponse, userId: string, body: UpdateUserRequest): void => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format.' });
        return;
    }

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
        return;
    }

    const updatedUser: User = {
        ...users[userIndex],
        ...body,
    };

    users[userIndex] = updatedUser;
    sendResponse(res, 200, updatedUser);
};

const deleteUser = (res: ServerResponse, userId: string): void => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format.' });
        return;
    }

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
        return;
    }

    users.splice(userIndex, 1);
    sendResponse(res, 204, {});
};

const parseRequestBody = (req: IncomingMessage, res: ServerResponse, callback: (body: CreateUserRequest | UpdateUserRequest) => void): void => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const parsedBody = JSON.parse(body);
            callback(parsedBody);
        } catch (error) {
            sendResponse(res, 400, { message: 'Invalid JSON format.' });
        }
    });
};

const requestListener = (req: IncomingMessage, res: ServerResponse): void => {
    const urlParts = req.url?.split('/').filter(Boolean);
    const method = req.method;

    try {
        if (urlParts && urlParts[0] === 'api' && urlParts[1] === 'users') {
            if (method === 'GET' && urlParts.length === 2) {
                getAllUsers(res);
            } else if (method === 'GET' && urlParts.length === 3) {
                const userId = urlParts[2];
                getUserById(res, userId);
            } else if (method === 'POST' && urlParts.length === 2) {
                parseRequestBody(req, res, (parsedBody: CreateUserRequest) => createUser(res, parsedBody));
            } else if (method === 'PUT' && urlParts.length === 3) {
                const userId = urlParts[2];
                parseRequestBody(req, res, (parsedBody: UpdateUserRequest) => updateUser(res, userId, parsedBody));
            } else if (method === 'DELETE' && urlParts.length === 3) {
                const userId = urlParts[2];
                deleteUser(res, userId);
            } else {
                sendResponse(res, 404, { message: 'Endpoint not found.' });
            }
        } else {
            sendResponse(res, 404, { message: 'Resource not found.' });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        sendResponse(res, 500, { message: 'An unexpected error occurred. Please try again later.' });
    }
};

const startLoadBalancer = (): void => {
    const loadBalancer = http.createServer((req, res) => {
        const workerId = (cluster.worker?.id || 0) % (cluster.workers ? Object.keys(cluster.workers).length : 1);
        const worker = cluster.workers[workerId];
        worker?.send({ req, res });
    });

    loadBalancer.listen(PORT, () => {
        console.log(`Load balancer is listening on http://localhost:${PORT}`);
    });
};

if (cluster.isPrimary) {
    const numCPUs = cpus().length;
    for (let i = 0; i < numCPUs - 1; i++) {
        cluster.fork();
    }

    startLoadBalancer();

} else {
    const server = http.createServer(requestListener);
    server.listen(PORT + cluster.worker.id, () => {
        console.log(`Worker ${cluster.worker.id} is listening on http://localhost:${PORT + cluster.worker.id}`);
    });

    process.on('message', (message: { req: IncomingMessage; res: ServerResponse }) => {
        const { req, res } = message;
        requestListener(req, res);
    });
}
