const { Room, User, Role, sequelize } = require('./models');

async function test() {
  try {
    console.log('--- DIAGNOSTIC START ---');
    await sequelize.authenticate();
    console.log('DB Connection: SUCCESS');
    console.log('DB Config:', {
      database: sequelize.config.database,
      username: sequelize.config.username,
      host: sequelize.config.host,
      port: sequelize.config.port
    });

    const roleCount = await Role.count().catch(e => `Error: ${e.message}`);
    const userCount = await User.count().catch(e => `Error: ${e.message}`);
    const roomCount = await Room.count().catch(e => `Error: ${e.message}`);
    
    console.log('Counts:', {
      roles: roleCount,
      users: userCount,
      rooms: roomCount
    });

    if (typeof roomCount === 'number') {
      const rooms = await Room.findAll();
      console.log('Rooms in DB:', rooms.map(r => r.toJSON()));
    }
  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    await sequelize.close();
  }
}

test();
