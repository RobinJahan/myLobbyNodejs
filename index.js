const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origins: ['http://localhost:8080', 'https://mylobby-vuejs-c10a6.web.app/']
    }
});

let rooms = [];

io.on('connection', (socket) => {
    //log
    console.log(`user ${socket.id} connected`);
   
    socket.on('setUser', (settings) => {
        try {
            // find room
            const room = rooms.find(r => r.id === settings.room)
            if (room){
                //check if userid is not already in users list
                if(!room.users.find(u => u.id === socket.id)) {
                    //set up new user
                    const newUser = {
                        id : socket.id,
                        name : settings.name,
                        avatar : parseInt(settings.avatar),
                    }
                    //add new user
                    room.users.push(newUser)
                    //logs
                    console.log(`user ${socket.id} set to users in room ${room.id}`);
                };
            }
        } catch (e) {
            console.error(`setUser error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    });

    socket.on('createRoom', ()=>{
        try {
            //create room Id
            let newRoomId = createRoomId();
            //ToDo Check if roomId does not exist
            if (rooms.length > 0) {
    
            }
            //ToDo push newRoom in rooms list => id, maxPlayer? admin? 
            rooms.push({
                id: newRoomId,
                master: socket.id,
                maxUsers: 4,
                users: [],
                gameMode: 0,
                status: "lobby",
                game: {players:[], winner: {}}
            })
            //socket join room
            socket.join(newRoomId);
            //emit event
            io.to(socket.id).emit('createdRoom', newRoomId);
            //logs
            console.log(`user ${socket.id} create room ${newRoomId}`);
        } catch (e) {
            console.error(`createRoom : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('joinRoom', (room) => {
        try {
            //check if room is not full
            const joinedRoom = rooms.find(r => r.id === room)
            if (!joinedRoom) io.to(socket.id).emit('error', 'Sorry, the room that you want to join does not exist')
            else if (joinedRoom.status !== 'lobby') io.to(socket.id).emit('error', 'You cannot join, the game is already started in this room.. sorry :(')
            else if(joinedRoom.maxUsers > joinedRoom.users.length){
                //socket join room
                socket.join(room);
                io.to(socket.id).emit('joinedRoom', room);
                //emit changes to room
                updateRoom(room)
                //logs
                console.log(`user ${socket.id} join ${room}`);
            } else {
                io.to(socket.id).emit('error', 'room full, sorry :(')
            }
        } catch (e) {
            console.error(`joinRoom error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    });

    socket.on('updatedRoom', (room) => {
        try {
            //emit changes to room
            updateRoom(room)
            //logs
            // console.log(`update room ${room}`);
        } catch (e) {
            console.log(`update error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    });

    socket.on('disconnect', () => {
        try {
            //find room
            const room = rooms.find(r => r.users.find(u => u.id === socket.id))
            if (room) {
                //find disconnected user
                const disconnectedUser = room.users.find(user => user.id === socket.id)
                //remove disconnected user from the room users list
                room.users = room.users.filter(user => user.id != disconnectedUser.id)
                socket.leave(room.id)
                //if userDisconnected was master, change the roomMaster
                if (room.users.length > 0 && room.master === disconnectedUser.id) room.master = room.users[0].id
                //emit changes to the room
                updateRoom(room.id)
                //if no user anymore, remove room
                if (room.users < 1) rooms = rooms.filter(r => r.id !== room.id)
                //logs
                console.log(`user ${disconnectedUser.id} disconnected from room ${room.id}`);
                console.log(rooms)
            }
        } catch (e) {
            console.error('disconnect error : ' + e)
        }
    });

    socket.on('setMaxUsers', (newMaxUsers) => {
        try {
            //find room
            const room = rooms.find(r => r.master === socket.id)
            if (room) {
                // change maxUsers
                room.maxUsers = newMaxUsers
                //emit changes to the room
                updateRoom(room.id)
                //log
                console.log(`user ${socket.id} set maxUsers at ${newMaxUsers} to room ${room.id}`);
            }
        } catch (e) {
            console.error(`setMaxUsers error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('set-gameMode', (newGameMode) => {
        try {
            //find room
            const room = rooms.find(r => r.master === socket.id)
            if (room) {
                // change gameMode
                room.gameMode = newGameMode
                //emit changes to the room
                updateRoom(room.id)
                //log
                console.log(`user ${socket.id} set gameMode at ${newGameMode} to room ${room.id}`);
            }
        } catch (e) {
            console.error(`setGameMode error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('kickUser', (kickedUserId) => {
        try {
            //find room
            const room = rooms.find(r => r.master === socket.id)
            if (room) {
                // remove the kicked user from users
                room.users = room.users.filter(user => user.id != kickedUserId)
                //emit changes to the room
                updateRoom(room.id)
                io.to(kickedUserId).emit('kicked')
                //log
                console.log(`user ${socket.id} kicked ${kickedUserId} off from room ${room.id}`);
            }
        } catch (e) {
            console.error(`kickUser error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('userLeaveRoom', (roomId)=>{
        try {
            //find room
            const room = rooms.find(r => r.id === roomId)
            if (room) {
                // remove the user from users
                room.users = room.users.filter(user => user.id != socket.id)
                socket.leave(roomId)
                //if the leaving user was master, change the roomMaster
                if (room.users.length > 0 && room.master === socket.id) room.master = room.users[0].id
                //emit changes to the room
                updateRoom(room.id)
                //log
                console.log(`user ${socket.id} left room ${room.id}`);
                //if no user anymore, remove room
                if (room.users < 1) {
                    rooms = rooms.filter(r => r.id !== room.id)
                    console.log(`no more users, room ${room.id} removed`)
                }

            }
        } catch (e) {
            console.error(`userLeaveRoom : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('kicked', (room) => {
        console.log(socket.id, 'leave', room)
        socket.leave(room)
    })

    socket.on('startGame', () => {
        try {
            //find room by the master id
            const room = rooms.find(r => r.master === socket.id && r.status === 'lobby')
            if (room) {
                if (room.users.length > 1) {
                    room.status = 'started'
                    setSimpleGame(room.id)
                    io.to(room.id).emit('countdown', '3')
                    setTimeout(()=>{ 
                        io.to(room.id).emit('countdown', '2')
                    }, 1000)
                    setTimeout(()=>{
                        io.to(room.id).emit('countdown', '1')                    }, 2000)
                    setTimeout(()=>{
                        //emit the event 
                        io.to(room.id).emit('gameStarted')
                        io.to(room.id).emit('countdown', 'GO !') 
                        //log
                        console.log(`game room ${room.id} started`);
                    }, 3000)
                } else {
                    io.to(socket.id).emit('error', 'You cant play alone, invite friends !')
                }
            }
        } catch (e) {
            console.error(`startGame error : ${e}`)
            io.to(socket.id).emit('error', 'an error occured :(')
        }
    })

    socket.on('checkUser', () => {
        try {
            //find room by user
            const room = rooms.find(r => r.users.find(u => u.id === socket.id))
            if (!room) {
                // if there is no room with this user, emit him he is not allowed
                io.to(socket.id).emit('notAllowed')
                //log
                console.log(`user ${socket.id} not allowed`);
            }
        } catch (e) {
            console.error(`checkUser error : ${e}`)
        }
    })

    socket.on('clickPlayer', (id) => {
        try {
            //find room by user
            const room = rooms.find(r => r.users.find(u => u.id === socket.id))
            if (room && room.status === 'started') {
                //find user
                const player = room.game.players.find(p => p.id === id)
                player && player.unclicked ? player.unclicked = false : null
                console.log(`user ${socket.id} clicked user ${id} in room ${room.id}`)
                //check if winner
                if (room.game.players.filter(p => true === p.unclicked).length === 1) {
                    const winner = room.game.players.find(p => p.unclicked === true)
                    room.status = 'ended'
                    room.game.winner = winner
                    io.to(room.id).emit('winner', winner)
                    //log
                    console.log(`user ${socket.id} is the winner of ${room.id}`)
                }
                //emit changes to the room
                updateRoom(room.id)
            }
        } catch (e) {
            console.error(`checkUser error : ${e}`)
        }
    })


    socket.on('returnLobby', () => {
        try {
            //find room by user
            const room = rooms.find(r => r.users.find(u => u.id === socket.id))
            if (room && room.status === 'ended') {
                //find user
                room.status = 'lobby'
                room.game = {players:[], winner: {}}
                io.to(room.id).emit('returnLobby')
            }
        } catch (e) {
            console.error(`checkUser error : ${e}`)
        }
    })
});

server.listen(process.env.PORT, () => {
    console.log(`listening http on port :${process.env.PORT}`);
});

function createRoomId(){
    return Math.random().toString(36).slice(2, 10)
}

function updateRoom(roomId){
    io.to(roomId).emit('updatedRoom', rooms.find(r => r.id === roomId))
}

function setSimpleGame(roomId){
    try {
        //find room by id
        const room = rooms.find(r => r.id === roomId)
        if (room) {
            room.users.forEach(user => {
                room.game.players.push({
                    ...user,
                    unclicked: true
                })
            });
            console.log(room)            
        }
    } catch (e) {
        console.error(`setSimpleGame error : ${e}`)
    }
}
