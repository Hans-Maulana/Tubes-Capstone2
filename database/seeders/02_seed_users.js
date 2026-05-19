const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  await knex('users').insert([
    {
      name: 'Super Administrator',
      email: 'admin@lab.com',
      password: hashedPassword,
      role_id: 1,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: 'Kepala Lab',
      email: 'kalab@lab.com',
      password: hashedPassword,
      role_id: 2,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: 'Ketua Prodi',
      email: 'kaprodi@lab.com',
      password: hashedPassword,
      role_id: 3,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: 'Staf Administrasi',
      email: 'adminstaff@lab.com',
      password: hashedPassword,
      role_id: 4,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: 'Staf Lapangan',
      email: 'staff@lab.com',
      password: hashedPassword,
      role_id: 5,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
};
