export async function supportsTransactions(connection) {
  if (!connection?.db?.admin) {
    return false;
  }

  const helloResult = await connection.db.admin().command({ hello: 1 });
  const topologyMessage = typeof helloResult?.msg === 'string' ? helloResult.msg.toLowerCase() : '';
  const isSharded = topologyMessage === 'isdbgrid';
  const isReplicaSet = Boolean(helloResult?.setName);

  return isSharded || isReplicaSet;
}
