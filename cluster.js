var cluster = require("cluster");

if (cluster.isMaster) {
  // Count the machine's CPUs
  console.log("cluster started");
  var cpuCount = require("os").cpus().length;

  // Create a worker for each CPU
  for (var i = 0; i < cpuCount; i += 1) {
    cluster.fork();
  }

  // Listen for dying workers
  cluster.on("exit", function() {
    console.log("cluster died, restarting cluster");
    cluster.fork();
  });
} else {
  require("./server");
}
