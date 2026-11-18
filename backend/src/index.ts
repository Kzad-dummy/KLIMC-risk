import { IoManager } from './managers/IoManager';
import { UserManager } from './managers/UserManager';

const PORT = Number(process.env.PORT) || 3000;

const io = IoManager.getIo();

const userManager = new UserManager();

io.on('connection', (socket) => {
    userManager.addUser(socket);
});

IoManager.getServer().listen(PORT, () => console.log(`Listening on ${PORT}`));