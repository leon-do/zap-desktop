import { createSelector } from 'reselect'
import throttle from 'lodash.throttle'
import { send } from 'redux-electron-ipc'
import { requestSuggestedNodes } from 'lib/utils/api'
import { showError } from './notification'
import { fetchBalance } from './balance'
import { walletSelectors } from './wallet'
import { updateNodeData } from './network'

// ------------------------------------
// Constants
// ------------------------------------
export const SHOW_CHANNEL_DETAILS = 'SHOW_CHANNEL_DETAILS'
export const SET_CHANNEL_FORM = 'SET_CHANNEL_FORM'

export const GET_CHANNELS = 'GET_CHANNELS'
export const RECEIVE_CHANNELS = 'RECEIVE_CHANNELS'

export const OPENING_CHANNEL = 'OPENING_CHANNEL'
export const OPENING_SUCCESSFUL = 'OPENING_SUCCESSFUL'
export const OPENING_FAILURE = 'OPENING_FAILURE'

export const CLOSING_CHANNEL = 'CLOSING_CHANNEL'
export const CLOSING_SUCCESSFUL = 'CLOSING_SUCCESSFUL'
export const CLOSING_FAILURE = 'CLOSING_FAILURE'

export const UPDATE_SEARCH_QUERY = 'UPDATE_SEARCH_QUERY'

export const SET_VIEW_TYPE = 'SET_VIEW_TYPE'

export const CHANGE_CHANNEL_FILTER = 'CHANGE_CHANNEL_FILTER'

export const ADD_LOADING_PUBKEY = 'ADD_LOADING_PUBKEY'
export const REMOVE_LOADING_PUBKEY = 'REMOVE_LOADING_PUBKEY'

export const ADD_ClOSING_CHAN_ID = 'ADD_ClOSING_CHAN_ID'
export const REMOVE_ClOSING_CHAN_ID = 'REMOVE_ClOSING_CHAN_ID'

export const SET_SELECTED_CHANNEL = 'SET_SELECTED_CHANNEL'

export const GET_SUGGESTED_NODES = 'GET_SUGGESTED_NODES'
export const RECEIVE_SUGGESTED_NODES_ERROR = 'RECEIVE_SUGGESTED_NODES_ERROR'
export const RECEIVE_SUGGESTED_NODES = 'RECEIVE_SUGGESTED_NODES'

// ------------------------------------
// Helpers
// ------------------------------------

/**
 * Get the channel data from aq channel object.
 * If this is a pending channel, the channel data will be stored under the `channel` key.
 * @param  {Object} channelObj Channel object
 * @return {Object} Channel data
 */
const getChannelData = channelObj => channelObj.channel || channelObj

/**
 * Get a name to display for the channe.
 *
 * This will either be:
 *  - the alias of the node at the othe end of the channel
 *  - a shortened public key.
 * @param  {Object} channel Channel object.
 * @param  {Array} nodes Array of nodes.
 * @return {SAtring} Channel display name.
 */
const getDisplayName = (channel, nodes) => {
  const remoteNodePubkey = getRemoteNodePubKey(channel)
  const node = nodes.find(n => n.pub_key === remoteNodePubkey)

  if (node && node.alias && node.alias.length) {
    return node.alias
  }

  return remoteNodePubkey.substring(0, 10)
}

/**
 * Get the remote pubkey depending on what type of channel.
 *
 * due to inconsistent API vals the remote nodes pubkey will be under remote_pubkey for active channels and
 * remote_node_pub for pending channels.
 * we have
 * @param  {[type]} channel [description]
 * @return {[type]}         [description]
 */
const getRemoteNodePubKey = channel => {
  return channel.remote_pubkey || channel.remote_node_pub
}

/**
 * Determine the status of a channel.
 * @param  {Object} channel Channel object.
 * @param  {Array} closingChannelIds List of channel ids that we are in the process of closing.
 * @return {String} Channel status name.
 */
const getStatus = (channel, closingChannelIds) => {
  // if the channel has a confirmation_height property that means it's pending
  if ('confirmation_height' in channel) {
    return 'pending'
  }
  // if the channel has a closing tx that means it's closing
  if ('closing_txid' in channel) {
    return 'closing'
  }
  // if the channel is in waiting_close_channels phase
  if ('limbo_balance' in channel) {
    return 'closing'
  }
  // if we are in the process of closing this channel
  if (closingChannelIds.includes(channel.chan_id)) {
    return 'closing'
  }
  // if the channel isn't active that means the remote peer isn't online
  if (!channel.active) {
    return 'offline'
  }
  // if all of the above conditionals fail we can assume the node is online :)
  return 'online'
}

/**
 * Decorate a channbel object with additiopnal calculated properties.
 * @param  {Object} channelObj Channel object.
 * @param  {Array} nodes Array of node data.
 * @param  {Array} closingChannelIds List of channel ids that we are in the process of closing.
 * @return {Object} Decorated channel object.
 */
const decorateChannel = (channelObj, nodes, closingChannelIds) => {
  // If this is a pending channel, the channel data will be stored under the `channel` key.
  const channelData = getChannelData(channelObj)

  const updatedChannelData = {
    ...channelData,
    display_pubkey: getRemoteNodePubKey(channelData),
    display_name: getDisplayName(channelData, nodes),
    display_status: getStatus(channelObj, closingChannelIds)
  }

  if (channelObj.channel) {
    return {
      ...channelObj,
      channel: updatedChannelData
    }
  }
  return updatedChannelData
}

// ------------------------------------
// Actions
// ------------------------------------

export function changeFilter(filter) {
  return {
    type: CHANGE_CHANNEL_FILTER,
    filter
  }
}

export function getChannels() {
  return {
    type: GET_CHANNELS
  }
}

export function openingChannel() {
  return {
    type: OPENING_CHANNEL
  }
}

export function closingChannel() {
  return {
    type: CLOSING_CHANNEL
  }
}

export function openingSuccessful() {
  return {
    type: OPENING_SUCCESSFUL
  }
}

export function openingFailure() {
  return {
    type: OPENING_FAILURE
  }
}

export function updateChannelSearchQuery(searchQuery) {
  return {
    type: UPDATE_SEARCH_QUERY,
    searchQuery
  }
}

export function setViewType(viewType) {
  return {
    type: SET_VIEW_TYPE,
    viewType
  }
}

export function addLoadingPubkey(pubkey) {
  return {
    type: ADD_LOADING_PUBKEY,
    pubkey
  }
}

export function removeLoadingPubkey(pubkey) {
  return {
    type: REMOVE_LOADING_PUBKEY,
    pubkey
  }
}

export function addClosingChanId(chanId) {
  return {
    type: ADD_ClOSING_CHAN_ID,
    chanId
  }
}

export function removeClosingChanId(chanId) {
  return {
    type: REMOVE_ClOSING_CHAN_ID,
    chanId
  }
}

export function setSelectedChannel(selectedChannel) {
  return {
    type: SET_SELECTED_CHANNEL,
    selectedChannel
  }
}

export function getSuggestedNodes() {
  return {
    type: GET_SUGGESTED_NODES
  }
}

export function receiveSuggestedNodesError() {
  return {
    type: RECEIVE_SUGGESTED_NODES_ERROR
  }
}

export function receiveSuggestedNodes(suggestedNodes) {
  return {
    type: RECEIVE_SUGGESTED_NODES,
    suggestedNodes
  }
}

export const fetchSuggestedNodes = () => async dispatch => {
  dispatch(getSuggestedNodes())
  try {
    const suggestedNodes = await requestSuggestedNodes()
    dispatch(receiveSuggestedNodes(suggestedNodes))
  } catch (e) {
    dispatch(receiveSuggestedNodesError())
  }
}

// Send IPC event for peers
export const fetchChannels = () => async dispatch => {
  dispatch(getChannels())
  dispatch(send('lnd', { msg: 'channels' }))
}

// Receive IPC event for channels
export const receiveChannels = (event, { channels, pendingChannels }) => dispatch => {
  dispatch({ type: RECEIVE_CHANNELS, channels, pendingChannels })
  dispatch(fetchBalance())
}

// Send IPC event for opening a channel
export const openChannel = ({ pubkey, host, localamt }) => async (dispatch, getState) => {
  // Grab the activeWallet type from our local store. If the active connection type is local (light clients using
  // neutrino) we will flag manually created channels as private. Other connections like remote node and BTCPay Server
  // we will announce to the network as these users are using Zap to drive nodes that are online 24/7
  const state = getState()
  const activeWalletSettings = walletSelectors.activeWalletSettings(state)
  const isPrivate = activeWalletSettings.type === 'local'

  dispatch(openingChannel())
  dispatch(addLoadingPubkey(pubkey))
  dispatch(
    send('lnd', {
      msg: 'connectAndOpen',
      data: { pubkey, host, localamt, private: isPrivate }
    })
  )
}

// TODO: Decide how to handle streamed updates for channels
// Receive IPC event for openChannel
export const channelSuccessful = () => dispatch => {
  dispatch(fetchChannels())
}

// Receive IPC event for updated channel
export const pushchannelupdated = (event, { pubkey }) => dispatch => {
  dispatch(fetchChannels())
  dispatch(removeLoadingPubkey(pubkey))
}

// Receive IPC event for channel end
export const pushchannelend = () => dispatch => {
  dispatch(fetchChannels())
}

// Receive IPC event for channel error
export const pushchannelerror = (event, { pubkey, error }) => dispatch => {
  dispatch(openingFailure())
  dispatch(showError(error))
  dispatch(removeLoadingPubkey(pubkey))
}

// Receive IPC event for channel status
export const pushchannelstatus = () => dispatch => {
  dispatch(fetchChannels())
}

// Send IPC event for opening a channel
export const closeChannel = ({ channel_point, chan_id, force }) => dispatch => {
  dispatch(closingChannel())
  dispatch(addClosingChanId(chan_id))

  const [funding_txid, output_index] = channel_point.split(':')
  dispatch(
    send('lnd', {
      msg: 'closeChannel',
      data: {
        channel_point: {
          funding_txid,
          output_index
        },
        chan_id,
        force
      }
    })
  )
}

// TODO: Decide how to handle streamed updates for closing channels
// Receive IPC event for closeChannel
export const closeChannelSuccessful = () => dispatch => {
  dispatch(fetchChannels())
}

// Receive IPC event for updated closing channel
export const pushclosechannelupdated = (event, data) => dispatch => {
  dispatch(fetchChannels())
  dispatch(removeClosingChanId(data.chan_id))
}

// Receive IPC event for closing channel end
export const pushclosechannelend = () => dispatch => {
  dispatch(fetchChannels())
}

// Receive IPC event for closing channel error
export const pushclosechannelerror = (event, { error, chan_id }) => dispatch => {
  dispatch(showError(error))
  dispatch(removeClosingChanId(chan_id))
}

// Receive IPC event for closing channel status
export const pushclosechannelstatus = () => dispatch => {
  dispatch(fetchChannels())
}

/**
 * Throttled dispatch to fetchChannels.
 * Calls fetchChannels no more than once per second.
 */
const throttledFetchChannels = throttle(dispatch => dispatch(fetchChannels()), 1000, {
  leading: true,
  trailing: true
})

// IPC event for channel graph data
export const channelGraphData = (event, data) => (dispatch, getState) => {
  const { info, channels } = getState()
  const {
    channelGraphData: { channel_updates, node_updates }
  } = data

  // Process node updates.
  if (node_updates.length) {
    dispatch(updateNodeData(node_updates))
  }

  // if there are any new channel updates
  let hasUpdates = false
  if (channel_updates.length) {
    // loop through the channel updates
    for (let i = 0; i < channel_updates.length; i += 1) {
      const channel_update = channel_updates[i]
      const { advertising_node, connecting_node } = channel_update

      // Determine wether this update affected our node or any of our channels.
      if (
        info.data.identity_pubkey === advertising_node ||
        info.data.identity_pubkey === connecting_node ||
        channels.channels.find(channel => {
          return [advertising_node, connecting_node].includes(channel.remote_pubkey)
        })
      ) {
        hasUpdates = true
      }
    }
  }

  // if our node or any of our chanels were involved in this update, fetch an updated channel list.
  if (hasUpdates) {
    // We can receive a lot of channel updates from channel graph subscription in a short space of time. If these
    // nvolve our our channels we make a call to fetchChannels and then fetchBalances in order to refresh our channel
    // and balance data. Throttle these calls so that we don't attempt to fetch channels to often.
    throttledFetchChannels(dispatch)
  }
}

// IPC event for channel graph status
export const channelGraphStatus = () => () => {}

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [SET_CHANNEL_FORM]: (state, { form }) => ({
    ...state,
    channelForm: Object.assign({}, state.channelForm, form)
  }),

  [GET_CHANNELS]: state => ({ ...state, channelsLoading: true }),
  [RECEIVE_CHANNELS]: (state, { channels, pendingChannels }) => ({
    ...state,
    channelsLoading: false,
    channels,
    pendingChannels
  }),

  [OPENING_CHANNEL]: state => ({ ...state, openingChannel: true }),
  [OPENING_FAILURE]: state => ({ ...state, openingChannel: false }),

  [CLOSING_CHANNEL]: state => ({ ...state, closingChannel: true }),

  [UPDATE_SEARCH_QUERY]: (state, { searchQuery }) => ({ ...state, searchQuery }),

  [SET_VIEW_TYPE]: (state, { viewType }) => ({ ...state, viewType }),

  [CHANGE_CHANNEL_FILTER]: (state, { filter }) => ({
    ...state,
    filter
  }),

  [ADD_LOADING_PUBKEY]: (state, { pubkey }) => ({
    ...state,
    loadingChannelPubkeys: [pubkey, ...state.loadingChannelPubkeys]
  }),
  [REMOVE_LOADING_PUBKEY]: (state, { pubkey }) => ({
    ...state,
    loadingChannelPubkeys: state.loadingChannelPubkeys.filter(
      loadingPubkey => loadingPubkey !== pubkey
    )
  }),

  [ADD_ClOSING_CHAN_ID]: (state, { chanId }) => ({
    ...state,
    closingChannelIds: [chanId, ...state.closingChannelIds]
  }),
  [REMOVE_ClOSING_CHAN_ID]: (state, { chanId }) => ({
    ...state,
    closingChannelIds: state.closingChannelIds.filter(closingChanId => closingChanId !== chanId)
  }),

  [SET_SELECTED_CHANNEL]: (state, { selectedChannel }) => ({ ...state, selectedChannel }),

  [GET_SUGGESTED_NODES]: state => ({ ...state, suggestedNodesLoading: true }),
  [RECEIVE_SUGGESTED_NODES]: (state, { suggestedNodes }) => ({
    ...state,
    suggestedNodesLoading: false,
    suggestedNodes
  }),
  [RECEIVE_SUGGESTED_NODES_ERROR]: state => ({
    ...state,
    suggestedNodesLoading: false,
    suggestedNodes: {
      mainnet: [],
      testnet: []
    }
  })
}

const channelsSelectors = {}
const channelsSelector = state => state.channels.channels
const pendingOpenChannelsSelector = state => state.channels.pendingChannels.pending_open_channels
const pendingClosedChannelsSelector = state =>
  state.channels.pendingChannels.pending_closing_channels
const pendingForceClosedChannelsSelector = state =>
  state.channels.pendingChannels.pending_force_closing_channels
const waitingCloseChannelsSelector = state => state.channels.pendingChannels.waiting_close_channels
const closingChannelIdsSelector = state => state.channels.closingChannelIds
const channelSearchQuerySelector = state => state.channels.searchQuery
const filterSelector = state => state.channels.filter
const nodesSelector = state => state.network.nodes

const channelMatchesQuery = (channelObj, searchQuery) => {
  if (!searchQuery) {
    return true
  }

  const channel = getChannelData(channelObj)
  const query = searchQuery.toLowerCase()

  const remoteNodePub = (channel.remote_node_pub || '').toLowerCase()
  const remotePubkey = (channel.remote_pubkey || '').toLowerCase()
  const displayName = (channel.display_name || '').toLowerCase()

  return (
    remoteNodePub.includes(query) || remotePubkey.includes(query) || displayName.includes(query)
  )
}

channelsSelectors.channelsSelector = createSelector(
  channelsSelector,
  nodesSelector,
  closingChannelIdsSelector,
  (channels, nodes, closingChannelIds) =>
    channels.map(channel => decorateChannel(channel, nodes, closingChannelIds))
)

channelsSelectors.activeChannels = createSelector(
  channelsSelectors.channelsSelector,
  openChannels => openChannels.filter(channel => channel.active)
)

channelsSelectors.activeChannelPubkeys = createSelector(
  channelsSelectors.activeChannels,
  openChannels => openChannels.map(c => c.remote_pubkey)
)

channelsSelectors.nonActiveChannels = createSelector(
  channelsSelectors.channelsSelector,
  openChannels => openChannels.filter(channel => !channel.active)
)

channelsSelectors.nonActiveChannelPubkeys = createSelector(
  channelsSelectors.nonActiveChannels,
  openChannels => openChannels.map(c => c.remote_pubkey)
)

channelsSelectors.pendingOpenChannels = createSelector(
  pendingOpenChannelsSelector,
  nodesSelector,
  closingChannelIdsSelector,
  (pendingOpenChannels, nodes, closingChannelIds) =>
    pendingOpenChannels.map(channelObj => decorateChannel(channelObj, nodes, closingChannelIds))
)

channelsSelectors.pendingOpenChannelPubkeys = createSelector(
  channelsSelectors.pendingOpenChannels,
  pendingOpenChannels =>
    pendingOpenChannels.map(pendingChannel => pendingChannel.channel.remote_node_pub)
)

channelsSelectors.closingPendingChannels = createSelector(
  pendingClosedChannelsSelector,
  pendingForceClosedChannelsSelector,
  waitingCloseChannelsSelector,
  nodesSelector,
  closingChannelIdsSelector,
  (
    pendingClosedChannels,
    pendingForcedClosedChannels,
    waitingCloseChannels,
    nodes,
    closingChannelIds
  ) =>
    [...pendingClosedChannels, ...pendingForcedClosedChannels, ...waitingCloseChannels].map(
      channelObj => decorateChannel(channelObj, nodes, closingChannelIds)
    )
)

channelsSelectors.closingChannelIds = createSelector(
  closingChannelIdsSelector,
  channelsSelectors.closingPendingChannels,
  (closingChannelIds, closingPendingChannels) => [
    ...closingChannelIds,
    ...closingPendingChannels.map(pendingChannel => pendingChannel.channel.chan_id)
  ]
)

channelsSelectors.allChannels = createSelector(
  channelsSelectors.activeChannels,
  channelsSelectors.pendingOpenChannels,
  channelsSelectors.closingPendingChannels,
  channelsSelectors.nonActiveChannels,
  (activeChannels, pendingOpenChannels, closingPendingChannels, nonActiveChannels) => {
    return [
      ...activeChannels,
      ...pendingOpenChannels,
      ...closingPendingChannels,
      ...nonActiveChannels
    ]
  }
)

channelsSelectors.currentChannels = createSelector(
  channelsSelectors.allChannels,
  channelsSelectors.activeChannels,
  channelsSelectors.channelsSelector,
  channelsSelectors.pendingOpenChannels,
  channelsSelectors.closingPendingChannels,
  channelsSelectors.nonActiveChannels,
  channelsSelectors.closingChannelIds,
  filterSelector,
  channelSearchQuerySelector,
  (
    allChannelsArr,
    activeChannelsArr,
    openChannels,
    pendingOpenChannels,
    pendingClosedChannels,
    nonActiveChannelsArr,
    closingChannelIds,
    channelFilter,
    searchQuery
  ) => {
    // Helper function to deliver correct channel array based on filter
    const filteredArray = filterKey => {
      switch (filterKey) {
        case 'ALL_CHANNELS':
          return allChannelsArr
        case 'ACTIVE_CHANNELS':
          return activeChannelsArr
        case 'NON_ACTIVE_CHANNELS':
          return nonActiveChannelsArr
        case 'OPEN_CHANNELS':
          return openChannels
        case 'OPEN_PENDING_CHANNELS':
          return pendingOpenChannels
        case 'CLOSING_PENDING_CHANNELS':
          return pendingClosedChannels
        default:
          return []
      }
    }
    const filterChannel = channel => channelMatchesQuery(channel, searchQuery)

    return filteredArray(channelFilter).filter(filterChannel)
  }
)

export { channelsSelectors }

// ------------------------------------
// Reducer
// ------------------------------------
const initialState = {
  channelsLoading: false,
  channels: [],
  pendingChannels: {
    total_limbo_balance: '',
    pending_open_channels: [],
    pending_closing_channels: [],
    pending_force_closing_channels: [],
    waiting_close_channels: []
  },
  channelForm: {
    isOpen: false,
    node_key: '',
    local_amt: '',
    push_amt: ''
  },
  openingChannel: false,
  closingChannel: false,
  searchQuery: null,
  viewType: 0,

  filter: 'ALL_CHANNELS',
  filters: [
    { key: 'ALL_CHANNELS', name: 'All' },
    { key: 'ACTIVE_CHANNELS', name: 'Online' },
    { key: 'NON_ACTIVE_CHANNELS', name: 'Offline' },
    { key: 'OPEN_PENDING_CHANNELS', name: 'Pending' },
    { key: 'CLOSING_PENDING_CHANNELS', name: 'Closing' }
  ],

  loadingChannelPubkeys: [],
  closingChannelIds: [],

  selectedChannel: null,

  // nodes stored at zap.jackmallers.com/suggested-peers manages by JimmyMow
  // we store this node list here and if the user doesnt have any channels
  // we show them this list in case they wanna use our suggestions to connect
  // to the network and get started
  // **** Example ****
  // {
  //   pubkey: "02212d3ec887188b284dbb7b2e6eb40629a6e14fb049673f22d2a0aa05f902090e",
  //   host: "testnet-lnd.yalls.org",
  //   nickname: "Yalls",
  //   description: "Top up prepaid mobile phones with bitcoin and altcoins in USA and around the world"
  // }
  // ****
  suggestedNodes: {
    mainnet: [],
    testnet: []
  },
  suggestedNodesLoading: false
}

export default function channelsReducer(state = initialState, action) {
  const handler = ACTION_HANDLERS[action.type]

  return handler ? handler(state, action) : state
}
