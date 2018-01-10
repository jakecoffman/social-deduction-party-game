<template>
  <div class="hello">
    <a :href="linky()">{{game.Id}}</a>
    <div v-if="game.State === 'lobby'">
      <h2>Waiting for more players</h2>
      Waiting for 5 - 10 players.
      <div>
        <button class="pure-button pure-button-primary" @click="send({Type: 'addbot'})">Add bot</button>
        <button class="pure-button pure-button-primary" @click="send({Type: 'removebot'})">Remove bot</button>
        <button class="pure-button pure-button-primary" @click="send({Type: 'start'})">Start game</button>
      </div>
    </div>
    <div v-if="game.State === 'building'">
      <div v-if="you.IsLeader">
        <h2>Build a team</h2>
        You are the Leader. Select a team to go on the mission.
        <div>
          <button class="pure-button pure-button-primary" @click="send({Type: 'assign', Data: selected})">
            Submit
          </button>
        </div>
      </div>
      <div v-if="!you.IsLeader">
        <h2>Waiting on the Leader</h2>
        Waiting for leader to select away team.
      </div>
    </div>
    <div v-if="game.State === 'voting'">
      <h2>Vote on mission team</h2>
      Vote if you approve of this team.
      <div>
        <button class="pure-button pure-button-primary" @click="send({Type: 'voteteam', Data: true})">Accept</button>
        <button class="pure-button pure-button-primary" @click="send({Type: 'voteteam', Data: false})">Reject</button>
      </div>
    </div>
    <div v-if="game.State === 'mission'">
      <div v-if="you.OnMission">
        <h2>On mission</h2>
        <p>Vote for if this mission succeeds or fails</p>

        <p>If you are Resistance, you cannot vote to Fail.</p>

        <div>
          <button class="pure-button pure-button-primary" @click="send({Type: 'votemission', Data: true})">
            Succeed
          </button>
          <button class="pure-button pure-button-primary" @click="send({Type: 'votemission', Data: false})">
            Fail
          </button>
        </div>
      </div>
      <div v-if="!you.OnMission">
        <h2>Waiting for mission team</h2>
        Waiting for the players on the mission to vote.
      </div>
    </div>
    <div v-if="game.State === 'spywin'">
      <h2>Spies win!</h2>

      <button class="pure-button pure-button-primary" @click="send({Type: 'ready'})">Ready</button>
    </div>
    <div v-if="game.State === 'resistancewin'">
      <h2>Resistance win!</h2>

      <button class="pure-button pure-button-primary" @click="send({Type: 'ready'})">Ready</button>
    </div>

    <br/>

    <div id="players">
      <div class="player" v-for="(p, index) in game.Players" :class="{you: p.Id === you.Id}">
        <span v-if="p.IsLeader">🎖</span>
        <span v-if="p.Name">{{p.Name}}</span>
        <span v-if="!p.Name && p.Id === you.Id">You</span>
        <span v-if="!p.Name && p.Id !== you.Id">Player {{p.Id}}</span>
        <br/>
        <span v-if="revealed && you.Spies && you.Spies.indexOf(index) > -1">🕵</span>
        <span v-if="!p.IsBot && !p.Connected">⚠</span>
        <span v-if="p.IsBot">🤖</span>
        <span v-if="p.OnMission">🔫</span>
        <br/>
        <button class="pure-button pure-button-primary"
                v-if="game.State === 'building' && you.IsLeader"
                @click="toggleteam(index)">Select</button>
        <span v-if="selected.indexOf(index) > -1">🔫</span>
      </div>
    </div>

    <div v-if="game.State !== 'lobby'">
      <button class="pure-button" @click="reveal">Show/Hide spies</button>
      <div v-if="revealed">
        <div v-if="!you.Spies">
          <p>You are not a spy.</p>
        </div>
      </div>
    </div>

    <h2>Missions</h2>
    <ul>
      <li v-for="(m, i) in game.Missions">
                <span v-if="!m.Complete">
                    Team members required: {{m.Slots}}
                </span>
        <div v-if="m.Complete">
          <div>
            Mission {{i+1}}
            <span v-if="m.Success"> succeeded 🙌</span>
            <span v-if="!m.Success">failed <span v-for="n in m.NumFails">💥</span></span>
            (<span v-for="i in m.Assignments">
                    <span v-if="game.Players[i].Name">{{game.Players[i].Name}} </span>
                    <span v-else>Player {{game.Players[i].Id}} </span>
                    </span>)
          </div>
        </div>
      </li>
    </ul>

    <h2>vote history</h2>

    <table id="votes">
      <thead>
      <tr>
        <th>#</th>
        <th v-for="p in game.Players" :class="{you: p.Id === you.Id}">
          <span v-if="p.Name">{{p.Name}}</span>
          <span v-else>Player {{p.Id}}</span>
        </th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="h in game.History">
        <td>{{h.Mission+1}}</td>
        <td v-for="(p, index) in game.Players" :class="{you: p.Id === you.Id}">
          <span v-if="h.Votes[index]">👍</span><span v-else>👎</span>
        </td>
      </tr>
      </tbody>
    </table>

    <p>Rejected votes this round: {{game.NumFailed}} (5 means spies win)</p>

    <div id="msgs" v-if="msgs.length > 0">
      <div>
        <p v-for="(m, i) in msgs">{{m}}</p>
      </div>
      <div>
        <button class="pure-button pure-button-primary" id="dismiss" @click="msgs = []">X</button>
      </div>
    </div>

    <br/>
    <input type="text" maxlength="8" v-model="name" placeholder="Enter name">
    <button class="pure-button" @click="send({Type: 'name', Data: name})">Change name</button>

    <div id="connection" v-if="!initial && !connected">
      You have been disconnected. Refresh to reconnect.
    </div>
  </div>
</template>

<script>
export default {
  name: 'ResistanceGame',
  data() {
    return {
      ws: null,
      game: {Id: '', Players: {}, InGame: false, Version: 0},
      you: {},
      selected: [],
      msgs: [],
      linky: function () {
        return 'http://localhost:8112/#' + this.game.Id;
      },
      revealed: false,
      revealTimeout: null,
      connected: false,
      initial: true,
      name: '' // the users name
    }
  },
  created: function () {
    let url;
    if (location.protocol === 'https:') {
      url = 'wss://';
    } else {
      url = 'ws://';
    }
    url += location.host + location.pathname + (location.pathname.endsWith('/') ? 'ws' : '/ws');

    this.ws = new WebSocket(url);
    console.log(new Date().getTime(), 'Connecting');
    this.ws.onopen = this.onopen;
    this.ws.onmessage = this.onmessage;
    this.ws.onerror = this.onerror;
    this.ws.onclose = this.onclose;
  },
  methods: {
    onopen: function () {
      this.connected = true;
      this.initial = false;
      console.log(new Date().getTime(), 'Connected');
      if (this.$route.params.id) {
        this.ws.send(JSON.stringify({Type: "join", Data: this.$route.params.id}));
      } else {
        this.ws.send(JSON.stringify({Type: "join", Data: ''}));
      }
    },
    onerror: function (e) {
      console.log('error', e);
    },
    onclose: function (e) {
      this.connected = false;
    },
    onmessage: function (e) {
      const data = JSON.parse(e.data);
      switch (data.Type) {
        case "msg":
          this.msgs.push(data.Msg);
          break;
        case "all":
          location.hash = data.Update.Id;
          this.game = data.Update;
          this.you = data.You;
          this.selected = [];
          break;
        case "cookie":
          document.cookie = data.Cookie;
          break;
        default:
          console.log("I don't even", data);
      }
    },
    send: function (msg) {
      msg.Version = this.game.Version;
      this.ws.send(JSON.stringify(msg));
    },
    toggleteam: function (index) {
      const i = this.selected.indexOf(index);
      if (i === -1) {
        this.selected.push(index);
      } else {
        this.selected.splice(i, 1);
      }
    },
    reveal: function () {
      this.revealed = !this.revealed;
      if (this.revealed) {
        if (this.revealTimeout) {
          clearTimeout(this.revealTimeout);
        }
        this.revealTimeout = setTimeout(function () {
          this.revealed = false;
          this.revealTimeout = null;
        }.bind(this), 5000);
      }
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  body {
    margin: 16px;
  }

  #players {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .player {
    border-radius: 6px;
    -webkit-box-shadow: 0 1px 6px 0 rgba(0,0,0,0.3);
    box-shadow: 0 1px 6px 0 rgba(0,0,0,0.3);
    padding: 5px;
    margin-left: 5px;
    margin-bottom: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .you {
    background: lightblue;
  }

  #msgs {
    position: absolute;
    left: 10px;
    bottom: 10px;
    background: black;
    color: white;
    padding: 10px;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }
  table td, table th {
    border: 1px solid black;
  }
  table tr:first-child th {
    border-top: 0;
  }
  table tr:last-child td {
    border-bottom: 0;
  }
  table tr td:first-child,
  table tr th:first-child {
    border-left: 0;
  }
  table tr td:last-child,
  table tr th:last-child {
    border-right: 0;
  }

  #connection {
    display: block;
    position: fixed;
    bottom: 10px;
    left: 10px;
    right: 10px;
    background: #303030;
    color: white;
    padding: 10px 40px 10px 20px;
    z-index: 1000;
  }
</style>
