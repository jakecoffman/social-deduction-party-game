<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'app'
}
</script>

<style lang="scss">
  @import 'src/assets/normalize';
  @import 'src/assets/skeleton';

  body {
    margin: 6px;
    color: #cacaca;
    background: black;
  }
</style>
