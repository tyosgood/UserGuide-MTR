/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-6
 * Released:7-10-24
 * 
 * This Webex Device macro enables you to display user guides as
 * webviews on your devices main display or Room Navigator.
 * 
 * Full Readme, source code and license details available here:
 * https://github.com/wxsd-sales/userguide-macro
 * 
 * Updated by Tyler Osgood to support MTR mode
 * 
 ********************************************************/
import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  button: {
    name: 'User Guide', // The main button name on the UI and its Panel Page Tile
    color: '#6F739E',   // Color of the button - No impact in MTR
    icon: 'Help',       // Specify which prebuilt icon you want. eg. Concierge | Tv
    title: 'Tap to open and close content',
    MTR: true,
    closeContentWithPanel: true // Automatically close any open content when the panel closes
  },
  content: [
    {
      title: 'How to Join a MS Teams Meeting',    //Button name and modal tile
      url: 'https://www.youtube.com/embed/TJkz7oxIrOw?start=40&autoplay=1 ', // URL to be displayed
      target: 'OSD',  // The target screen, either OSD or Controller (Navigator)
      mode: 'Modal', // Can be Fullscreen or Modal
      autoclose: 40 // Time in seconds before web view auto closes, remove or set to null to prevent auto close
    },
    {
      title: 'How to Join a Webex Meeting',
      url: 'https://www.youtube.com/embed/GyXu1qQ8NsI?start=40&autoplay=1',
      target: 'OSD',
      mode: 'Fullscreen',
      autoclose: 40
    },
    {
      title: 'How to Join a Google Meeting',
      url: 'https://www.youtube.com/embed/8JX-_FxsO8g?start=39&autoplay=1',
      target: 'OSD',
      mode: 'Modal',
      autoclose: 30
    },
    {
      title: 'How to share your Laptop or Phone screen',
      url: 'https://www.youtube.com/embed/TJkz7oxIrOw?start=62&autoplay=1',
      target: 'Controller',
      mode: 'Modal',
      autoclose: 30
    },
    {
      title: 'How to Share using Airplay',
      url: 'https://www.youtube.com/embed/u4fv9qqL37U?autoplay=1',
      target: 'Controller',
      mode: 'Fullscreen',
      autoclose: 40
    }
  ],
  panelId: 'userguide' // Modify if you have multiple copies of this marcro on a single device
}

/*********************************************************
 * Below contains all the call event listeners
**********************************************************/

let loading = false;

xapi.Event.UserInterface.Extensions.Event.PageClosed.on(processPageClose);

// Close the Webview on the OSD if the panel has been closed on the touch
function processPageClose(event){
  if(event.PageId != config.panelId+'-page') return;
  if(!config.button.closeContentWithPanel) return;
  if(loading)return;

  console.log('User Guide Panel has been closed, closing open content');
  xapi.Command.UserInterface.WebView.Clear({ Target: 'OSD' });
}

xapi.Config.WebEngine.Mode.set('On')
  .then(result => {
    createPanel(config.button, config.content, config.panelId);
    updatedUI();
    // Start listening to Events and Statuses
    xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidget);
    xapi.Status.UserInterface.WebView.on(updatedUI);
    //xapi.Config.WebEngine.Features.Peripherals.AudioOutput.set('On');
  })
  .catch(error => console.warn('Unable to enable WebEgine, the feature may not be supported on this device.'))
  
let timers = {};

async function openWebview(content) {
  const target = await convertTarget(content.target)

  clearTimeout(timers[target])

  console.log(`Opening [${content.title}] on [${target}]`);
  loading = true;
  setTimeout(()=>{
    loading = false;
  }, 1000)
  xapi.Command.UserInterface.WebView.Display({
    Mode: content.mode,
    Title: content.title,
    Target: target,
    Url: content.url
  })
    .then(result => {
      if (!content.hasOwnProperty('autoclose') || content.autoclose == null) return;
      console.log(`Auto closing content in [${content.autoclose}] seconds`)
      timers[target] = setTimeout(closeWebview, content.autoclose * 1000, target);
    })
    .catch(e => console.log('Error: ' + e.message))
}

// Close the Webview
async function closeWebview(target) {
  target = await convertTarget(target);
  console.log(`Closing Webview on [${target}]`);
  xapi.Command.UserInterface.WebView.Clear({ Target: target });
}

// Identify if there are any in room navigators
function convertTarget(target) {
  if(target === 'OSD') return 'OSD';
  return xapi.Status.Peripherals.ConnectedDevice.get()
    .then(devices => {
      const navigators = devices.filter(d => {
        return d.Name.endsWith('Room Navigator') && d.Location == 'InsideRoom'
      })
      if( navigators.length == 0){
        console.log(`No in room navigators, changing WebView target to OSD`);
        return 'OSD';
      } else {
        return target;
      }
    })
    .catch(e => {
      console.log('No connected devices, changing WebView target to OSD`')
      return 'OSD'
    })
}

// Process Widget Clicks
async function processWidget(e) {
  if (e.Type !== 'clicked' || !e.WidgetId.startsWith(config.panelId+'-option')) return
  const widgets = await xapi.Status.UserInterface.Extensions.Widget.get();
  const widget = widgets.filter(widget => widget.WidgetId == e.WidgetId);
  const num = e.WidgetId.split('-').pop();
  console.log(`User Guide Button Clicked [${config.content[num].title}]`)
  if (widget[0].Value == 'active') {
    console.log(`Content [${config.content[num].title}] already active, closing`)
    closeWebview(config.content[num].target);
    return;
  }
  openWebview(config.content[num]);
}

// Updates the UI and show which content is visiable 
async function updatedUI() {
  console.log(`Updating UI for panel [${config.panelId}]`);
  const views = await xapi.Status.UserInterface.WebView.get();
  console.log(`Number of WebViews [${views.length}]`);
  config.content.forEach((content, index) => {
    const visiable = views.filter(view => {
      if(!compareURLs(view.URL, content.url)) return false;
      return (view.Type =='Integration' && view.Status == 'Visible');
      }).length > 0;
    xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: visiable ? 'active' : 'inactive',
      WidgetId: config.panelId + '-option-' + index
    })
  })
}

function compareURLs(a, b){
  a = decodeURIComponent(a).trim();
  b = decodeURIComponent(b).trim();
  return a.includes(b)
}

function createPanel(button, content, panelId) {
  console.log(`Creating Panel [${panelId}]`);
  let rows = '';
  if(content == undefined || content.length < 0){
    console.log(`No content available to show for [${panelId}]`);
    rows = `<Row><Widget>
            <WidgetId>${panelId}-no-content</WidgetId>
            <Name>No Content Available</Name>
            <Type>Text</Type>
            <Options>size=4;fontSize=normal;align=center</Options>
            </Widget></Row>`;
  } else {
    for (let i = 0; i < content.length; i++) {
      const row = `<Row><Widget>
                  <WidgetId>${panelId}-option-${i}</WidgetId>
                  <Name>${content[i].title}</Name>
                  <Type>Button</Type>
                  <Options>size=4</Options>
                  </Widget></Row>`;
      rows = rows.concat(row);
    }
  }
  const panel = `
    <Extensions><Panel>
      <Location>${button.MTR ? 'ControlPanel' : 'HomeScreen'}</Location>
      <Icon>${button.icon}</Icon>
      <Color>${button.color}</Color>
      <Name>${button.name}</Name>
      <ActivityType>Custom</ActivityType>
      <Page>
        <Name>${button.title}</Name>
        ${rows}
        <PageId>${panelId}-page</PageId>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel></Extensions>`;
  
  return xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel);
} 