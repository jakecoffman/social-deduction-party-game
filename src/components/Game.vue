<template>
  <div class="hello">
    <div v-if="game.State !== 'lobby'">
      <h3>missions</h3>
      <ol>
        <li v-for="(m, i) in game.Missions">
          <span v-if="m.Complete">
            <span v-if="m.Success"> succeeded 🙌</span>
            <span v-else>failed <span v-for="n in m.NumFails">💥</span></span>
          </span>
          <span v-else>
            Team members required: {{m.Slots}}
          </span>
        </li>
      </ol>
    </div>

    <div v-if="game.State === 'lobby'">
      <h2>lobby</h2>
      Game ID: {{game.Id}}
      <p>
        You need 5 - 10 players to start.
      </p>
      <p>
        Add bots or invite players to join this game by ID,
        or send them the link to this game.
      </p>
      <div class="flex center">
        <button @click="send({Type: 'addbot'})">add bot 🤖</button>
        <button @click="send({Type: 'removebot'})">remove bot 🤖</button>
      </div>
      <div class="flex center">
        <button class="button-primary" @click="send({Type: 'start'})">Start game</button>
      </div>
    </div>
    <div v-if="game.State === 'building'">
      <div v-if="you.IsLeader">
        <h2>build a team</h2>
        <p>You are the leader 🎖. Select a team to go on the mission and click Submit.</p>
        <div class="flex center">
          <button @click="send({Type: 'assign', Data: selected})" class="button-primary">
            Submit
          </button>
        </div>
      </div>
      <div v-else>
        <h2>waiting on the leader</h2>
        Waiting for leader 🎖 to select away team.
      </div>
    </div>
    <div v-if="game.State === 'voting'">
      <h2>vote on mission team</h2>
      <p>
        The leader 🎖 chose a team 🔫 to go on the mission.
      </p>
      <p>
        Accept or Reject the team.
      </p>
      <p>
        If 5 teams are rejected in a row, the Spies win. Current number of rejected teams:
        {{game.NumFailed}}.
      </p>
      <p v-if="game.NumFailed === 4" class="alert">
        If this team is rejected, spys win the game.
      </p>
      <div class="vote">
        <button @click="voteTeam(true)">Accept</button>
        <button @click="voteTeam(false)">Reject</button>
      </div>
      <div class="vote">
        <span v-if="voted">You voted</span>
      </div>
    </div>
    <div v-if="game.State === 'mission'">
      <div v-if="you.OnMission">
        <h2>on mission</h2>
        <p>Vote for if this mission succeeds or fails</p>

        <p>If you are not a Spy, you cannot vote to Fail.</p>

        <div class="vote">
          <button @click="voteMission(true)">
            Succeed
          </button>
          <button @click="voteMission(false)">
            Fail
          </button>
        </div>
        <div class="vote">
          <span v-if="voted">You voted</span>
        </div>
      </div>
      <div v-if="!you.OnMission">
        <h2>Waiting for mission team</h2>
        Waiting for the players on the mission to vote.
      </div>
    </div>
    <div v-if="game.State === 'spywin'">
      <h2>Spies win!</h2>
      <p>Click ready to go back to the lobby</p>

      <button @click="send({Type: 'ready'})">Ready</button>
    </div>
    <div v-if="game.State === 'resistancewin'">
      <h2>Spys lose!</h2>
      <p>Click ready to go back to the lobby</p>

      <button @click="send({Type: 'ready'})">Ready</button>
    </div>

    <h3>players</h3>

    <div id="players">
      <div v-for="(p, index) in game.Players" class="flex col center">
        <button class="select" v-if="game.State === 'building' && you.IsLeader" @click="toggleteam(index)">Select</button>
        <div class="player" :class="{you: p.Id === you.Id, suspect: suspects.indexOf(p.Id) > -1}" @click="suspect(p)">
          <span style="padding-top: 25px;">{{getName(p)}}</span>
          <div>
            <span class="badge" v-if="p.IsLeader">🎖</span>
            <span class="badge" v-if="revealed && you.Spies && you.Spies.indexOf(index) > -1">🕵</span>
            <span class="badge" v-if="!p.IsBot && !p.Connected">☠</span>
            <span class="badge" v-if="p.OnMission">🔫</span>
            <span class="badge" v-if="selected.indexOf(index) > -1">🔫</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="game.State !== 'lobby'">
      <div class="flex center col">
        <button class="pure-button" @click="reveal">Show/Hide spies</button>
        <div v-if="revealed">
          <div v-if="!you.Spies">
            <p>You are not a spy.</p>
          </div>
        </div>
      </div>

      <h3>history</h3>

      <table id="votes">
        <thead>
        <tr>
          <th>#</th>
          <th>Leader</th>
          <th>Team</th>
          <th>Rejected by</th>
        </tr>
        </thead>
        <tbody>
          <tr v-for="(h, i) in game.History">
            <td>
              {{h.Mission+1}}
            </td>
            <td>{{getName(game.Players[i%game.Players.length])}}</td>
            <td>
              <div v-for="pid in h.Assignments">
                <div v-for="(p, index) in game.Players" v-if="index === pid">
                  {{getName(p)}}
                </div>
              </div>
            </td>
            <td>
              <div v-for="(p, index) in game.Players" v-if="!h.Votes[index]">
                {{getName(p)}}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div id="msgs" v-if="msgs.length > 0">
      <p v-for="(m, i) in msgs">{{m}}</p>
      <div>
        <button class="u-pull-right" @click="msgs = []">Dismiss</button>
      </div>
    </div>

    <div v-if="game.State === 'lobby'">
      <hr/>

      <div class="flex">
        <input class="flex-1" type="text" maxlength="8" v-model="name" placeholder="enter name">
        <button @click="send({Type: 'name', Data: name})">rename</button>
      </div>

      <div class="flex">
        <input class="flex-1" type="number" maxlength="8" v-model="joinGame" placeholder="join game">
        <button @click="send({Type: 'join', Data: joinGame})">join</button>
      </div>
    </div>

    <div id="connection" v-if="!initial && !connected">
      You have been disconnected. Refresh to reconnect.
    </div>

    <div>
      <h4>Legend</h4>
      <ul class="unstyled">
        <li>🎖 leader - this player chooses the away team</li>
        <li>🕵 spy - can only be seen by other spys</li>
        <li>🔫 on mission - player is on/proposed for the mission</li>
        <li>☠ disconnected - this player needs to reconnect</li>
        <li>💥 mission failed - shows amount of fail votes</li>
        <li>🙌 mission succeeded - no fail votes</li>
      </ul>
    </div>

    <button @click="send({Type: 'join', Data: ''})">leave game</button>
  </div>
</template>

<script>
  export default {
    name: 'Game',
    data() {
      return {
        ws: null,
        game: {Id: '', Players: {}, InGame: false, Version: 0},
        you: {},
        selected: [],
        msgs: [],
        revealed: false,
        revealTimeout: null,
        connected: false,
        initial: true,
        lastGameState: null,
        voted: false,

        // user inputs
        name: '',
        joinGame: '',

        // local suspect list
        suspects: []
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
            this.revealed = this.game.State === "spywin" || this.game.State === "resistancewin";
            if (this.lastGameState !== this.game.State) {
              this.voted = false;
              this.lastGameState = this.game.State;
            }
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
      },
      getName: function(player) {
        if (player.Name) {
          return player.Name;
        }
        if (player.IsBot) {
          return "Bot " + player.Id
        }
        return "Player " + player.Id;
      },
      suspect: function(player) {
        const i = this.suspects.indexOf(player.Id);
        if (i > -1) {
          this.suspects.splice(i, 1);
        } else {
          this.suspects.push(player.Id);
        }
      },
      voteTeam(value) {
        this.send({Type: 'voteteam', Data: value});
        this.voted = true;
      },
      voteMission(value) {
        this.send({Type: 'votemission', Data: value});
        this.voted = true;
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
  $text: #cacaca;
  $outline: #787878;
  $info: #334;
  $accent: #223c21;
  $accent-light: #4f8a4c;

  input {
    color: black;
    background: #ebebeb;
    margin-right: 2px;
  }

  button {
    color: $text;
  }

  button.button-primary {
    background: $accent;
    border: 1px solid $accent-light;
  }

  #players {
    display: flex;
    align-items: center;
    justify-content: space-around;
    flex-direction: row;
    flex-wrap: wrap;
    font-size: 14px;
  }

  .player {
    color: white;
    background: #5d595a;
    border: 1px solid white;
    border-radius: 50%;
    padding: 5px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100px;
    min-height: 100px;
  }

  .you {
    background: $info;
  }

  #msgs {
    position: fixed;
    right: 10px;
    bottom: 10px;
    background: $info;
    color: $text;
    padding: 10px;

    display: flex;
    flex-direction: column;
    justify-content: space-between;

    border-radius: 6px;
  }

  table {
    width: 100%;
  }

  #connection {
    border-radius: 6px;
    display: block;
    position: fixed;
    bottom: 10px;
    left: 10px;
    right: 10px;
    background: #ff342e;
    color: $text;
    padding: 10px 40px 10px 20px;
    z-index: 1000;
  }

  ul.unstyled li {
    list-style:none;
    padding-left: 10px;
  }

  .vote {
    display: flex;
    align-items: center;
    justify-content: space-around;
  }

  #votes td {
    padding: 2px;
  }

  .alert {
    font-weight: bold;
    color: #ff342e;
  }

  .suspect {
    background: #6d1614;
  }

  .select {
    padding: 0 10px;
  }

  .flex {
    display: flex;
  }

  .flex-1 {
    flex: 1;
  }

  .col {
    flex-direction: column;
  }

  .center {
    align-items: center;
    justify-content: space-around;
  }

  .badge {
    font-size: 20px;
  }
</style>
