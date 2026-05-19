exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('roles').del();
  await knex('roles').insert([
    { id: 1, name: 'Administrator', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: 'Kepala Laboratorium', created_at: new Date(), updated_at: new Date() },
    { id: 3, name: 'Ketua Program Studi', created_at: new Date(), updated_at: new Date() },
    { id: 4, name: 'Staf Administrasi', created_at: new Date(), updated_at: new Date() },
    { id: 5, name: 'Staf Laboratorium', created_at: new Date(), updated_at: new Date() }
  ]);
};
