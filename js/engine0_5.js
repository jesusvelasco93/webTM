// Timesheets engine v 0.5
//
// This version uses firebug, Eclipse, and JSEclipse plugin!
//
// This a totally new remake of the engine based on Eclipse and JSEclipse!
//
// Timesheets engine is a Javasript based engine, which implements the SMIL 3.0 External Timing
// module is standard web browser. It has been tested in Firefox 2.0.0.9, Safari 3.0.3, and Opera 9.21.
// The engine first parses the timesheet information. It then finds the timedElements using
// CSS selectors. Finally, it acts as timer, which runs through the persentation.
//
// Copyright (c) 2007 Petri Vuorimaa, Helsinki University of Technology
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
// 
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

var log = false;			 // Display log (reguires firebug plug-in!

var timesheet;               // Timesheet is the root of the TimedElementTree
var c = 0;                   // The Timer counter
var waitStart = new Array(); // Timesheet elements inactive and waiting for start
var waitStop = new Array();  // Timesheet elements active and waiting for stop
var animate = new Array();   // Timesheet elements being animated

// User Events

var userBeginEvents = new Array();  // UserBeginEvents array stores references to elements, which begin attribute has user event
var userEndEvents = new Array();    // UserEndEvents array stores references to elements, which begin attribute has user event

// The following arrays are currenlty used by SEQ and EXCL time container

var userFirstEvents = new Array();   // UserFirstEvents array stores references to elements, which first attribute has user event
var userPrevEvents = new Array();    // UserPrevEvents array stores references to elements, which prev attribute has user event
var userNextEvents = new Array();    // UserNextEvents array stores references to elements, which next attribute has user event
var userLastEvents = new Array();    // UserLastEvents array stores references to elements, which last attribute has user event

var media;	// What is the current media (e.g., screen, print, ...)
var mediaInspector;
// cssSelector implements all the cssSelector functions.
// Currently, only the CSS Id and Class selectors are implemented.

function cssSelector(selector, startElement)
{
  var foundElements=new Array(); // Stores the found elements, which have correct elementClass
  var foundElementsCounter=0;    // IndexCounter for the foundElements array.

  // The getElementByClass implements the CSS Class seletor. It does a recursive search of
  // elementClass by using the searchElementByClass function.

  function getElementByClass(elementClass, startElement)
  {    
    var i;

    function searchElementByClass(elementClass, currentElement)
    {
      var i;

      if (currentElement.attributes != null)
      {
        for (i=0;i<currentElement.attributes.length;i++)
        {

          if (currentElement.attributes[i].nodeName == "class")

          {
            if (currentElement.attributes[i].nodeValue == elementClass)
            {
              foundElements[foundElementsCounter]=currentElement;
              foundElementsCounter++;
            }
          }
        }
        for (i=1;i<currentElement.childNodes.length;i=i+2)
        {
          searchElementByClass(elementClass, currentElement.childNodes[i]);
        }
      }
    }

    searchElementByClass(elementClass, startElement);
  }

  if (selector[0] == '#') // CSS Id selector found
  {
    foundElements[0]=document.getElementById(selector.substr(1)); // This calls the standard getElementById
    return foundElements;

  } else if (selector[0] == '.') // CSS Class selector found
  {
    if (startElement.attributes.length > 0)
    {
      if (log) console.log("Searching for class: " + selector.substr(1) + " ParentElement: " + startElement.nodeName + " CSS Selector: " + startElement.attributes[0].nodeValue);
    } else {
      if (log) console.log("Searching for class: " + selector.substr(1) + " ParentElement: " + startElement.nodeName);
    }
    getElementByClass(selector.substr(1), startElement); // This calls my own getElementByClass
    return foundElements;
  }
}

// TimedElement is the superclass for all timedElements
// (i.e., timesheet, seq, par, and item).
//
// (c) Petri Vuorimaa, 2007.

function timedElement()
{
}

// The create function parses a timedElement, its attributes (i.e., parseAttribute function),
// and creates all the children

timedElement.prototype.create = function(timesheetElement, parent, scope, indexNumber)
{
  var i;
  var j;
  var k;
  var foundElements = new Array;
  
  this.children = new Array();                 // Childrens contains references to child elements
  this.bodyElement = null;                     // Only items have matching body elements
  this.indexChild = 0;                         // Index to the current child
  this.state = 'inactive';                     // The default state of all timedElements in the beginning

  this.timesheetElement = timesheetElement;    // Element is reference to original Timesheet element
  this.indexNumber = indexNumber;              // IndexNumber
  this.parent = parent;                        // Parent is a reference to the parent (root does not have a parent).
  this.nodeName = timesheetElement.nodeName;   // NodeName (e.g., timesheet, par, seq, item) with prefix
  this.localName = timesheetElement.localName; // LocalName without prefix

  this.toStart = new Array();                  // ToStart contains references to elements, which should react to internal event, when this element starts
  this.toStop = new Array();                   // ToStop contains references to elements, which should react to internal event, when this element stops

  this.repeatCount = 1;					       // How many times this element has repeated
  
  this.parseAttributes(timesheetElement.attributes, this.indexNumber); // Parse attributes

  if (log) console.log("Timeheet element: " + this.nodeName + ", select: " + this.attributes.select + ", begin: " + this.attributes.begin + ", dur: " + this.attributes.dur + ", end: " + this.attributes.end); // Debug

  // Loop all childNodes

  j = 0;
  for (i=1; i<this.timesheetElement.childNodes.length; i=i+2)
  {
    switch (this.timesheetElement.childNodes[i].localName)
    {
    case "seq":
      this.children[j] = new timedElementSeq;
      this.children[j].create(this.timesheetElement.childNodes[i], this, scope, null);
       j++;
     break;

    case "excl":
      this.children[j] = new timedElementExcl;
      this.children[j].create(this.timesheetElement.childNodes[i], this, scope, null);
      j++;
      break;

    case "par":
      this.children[j] = new timedElementPar;
      this.children[j].create(this.timesheetElement.childNodes[i], this, scope, null);
      j++;
      break;

    case "item":
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
        this.children[j] = new timedElementItem;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], j);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];

        // Store the default display style and make the body element invisible

        if (this.children[j].bodyElement.styleOriginal == null)
          this.children[j].bodyElement.styleOriginal = this.children[j].bodyElement.style.display;
        this.children[j].bodyElement.style.display = 'none';
       
        j++;
      }
      break;

    case "prefetch":
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
      	if (log) console.log("foundelement[%i]: %s", k, foundElements[k].id);
        this.children[j] = new timedElementPrefetch;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], null);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];
		this.children[j].bodyElement.timedElement = this.children[j];
		
		// Remove img source temporaly
		
		if (log) console.log("c: " + c + " Removing img src of prefetch element: " + this.children[j].bodyElement.id);
        if (this.children[j].bodyElement.srcPrefetch == null)
          this.children[j].bodyElement.srcPrefetch = this.children[j].bodyElement.getAttribute('src');
		this.children[j].bodyElement.setAttribute('src', null);
        j++;
      }
      break;

//    if (log) console.warn("prefetch is not yet implemented!");
//    this.children[j] = new timedElementPrefetch;
//    this.children[j].create(this.timesheetElement.childNodes[i], this, scope, null);
//    this.children[j].remove();
//
//    j++;
//    break;
      
    case "animate":
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
        this.children[j] = new timedElementAnimate;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], null);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];
        j++;
      }
      break;
      
    case "set":
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
        this.children[j] = new timedElementSet;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], null);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];

        // Store the default set value
        
        this.children[j].setValue = this.children[j].bodyElement.style[this.children[j].attributes.attributeName];

        j++;
      }
      break;
      
    case "animateMotion":
      if (log) console.warn("animateMotion is not yet implemented!");
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
        this.children[j] = new timedElementAnimateMotion;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], null);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];
        j++;
      }
      break;
      
    case "animateColor":
      for (k = 0; k < this.timesheetElement.childNodes[i].attributes.length; k++)
      {
        if (this.timesheetElement.childNodes[i].attributes[k].nodeName == "select")
        {
          foundElements = cssSelector(this.timesheetElement.childNodes[i].attributes[k].nodeValue, scope);
        }
      }
      for (k=0; k < foundElements.length; k++)
      {
        this.children[j] = new timedElementAnimateColor;
        this.children[j].create(this.timesheetElement.childNodes[i], this, foundElements[k], null);

        // Look for matching body elements

        this.children[j].bodyElement = foundElements[k];
        j++;
      }
      break;
      
    default:
      if (log) console.warn("Unknown child type: " + timesheetElement.childNodes[i].nodeName);
    }
  }
}

// The start function

timedElement.prototype.start = function()
{
  var i;

  if (log) console.log("c: " + c + " Starting timesheet element: " + this.nodeName);

  this.state = 'active';
  for (i=0; i<this.children.length; i++)
  {
    // Increment the begin time, if beginInc is defined
        
    if (this.children[i].attributes.beginInc != null)
    {
      if (log) console.log("BeginInc: " + i * this.children[i].attributes.beginInc);
      this.children[i].attributes.begin = i * this.children[i].attributes.beginInc;
    }
  	
    this.children[i].start();
  }
}

// The stop function

timedElement.prototype.stop = function(inform)
{
  var i;

  if (log) console.log("c: " + c + " Stopping timesheet element: " + this.nodeName);

  this.state = 'inactive';

  // First, stop all the children

  for (i in this.children)
  {
    if (this.children[i].status != 'inactive')
    	this.children[i].stop(false);
  }

  // Inform parent about this

  if (inform) this.parent.childStop();
}

// The childStop function

timedElement.prototype.childStop = function()
{
  if (log) console.log("c: " + c + " My child has stopped: " + this.nodeName);
}

// The registerInternal event function

timedElement.prototype.registerInternal = function()
{
  var reference; // Stores temporally reference to the original element
  var child;     // Temporal pointer to the children of this element
  var i;

  // Create Links between timedElements, which depend on other elements

  if (this.attributes.beginInternalEvent != null)
  {
    reference = timesheet.getElementById(this.attributes.beginInternalEvent);
    if (log) console.log("id: " + this.attributes.beginInternalEvent + ", found: " + reference.attributes.id);
    if (reference == null)
    {
      if (log) console.log("Reference to element " + this.attributes.beginInternalEvent + " was not found");
    }
    if (log) console.log("TimedElement with beginInternalEvent: " + this.timesheetElement.nodeName + ", depends on: " + reference.bodyElement.id);
    i = reference.toStart.length;
    reference.toStart[i] = this;
  }

  for (child in this.children)
  {
    this.children[child].registerInternal();
  }
}

// getElementById implements the getElementsById method of timedElement object

timedElement.prototype.getElementById = function(id)
{
  var i;
  var result;

  if (this.attributes.id == id)
  {
    return this;
  } else
  {
    for (i in this.children)
    {
      result = this.children[i].getElementById(id);
      if (result != null)
      {
        return result;
      }
    }
  }
}

// The TIMESHEET TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementTimesheet()
{
}

timedElementTimesheet.prototype = new timedElement;

timedElementTimesheet.prototype.childStop = function()
{
  if (log) console.log("c: " + c + " My child has stopped: " + this.nodeName);
}

// The SEQ TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementSeq()
{
}

timedElementSeq.prototype = new timedElement;

// The start function

timedElementSeq.prototype.start = function()
{
  if (log) console.log("c: " + c + " Starting timesheet element: " + this.nodeName);
  this.state = 'active';
  this.children[this.indexChild].start();
}

// The next function is called by current child
// It stops by itself
//
//timedElementSeq.prototype.next = function()
//{
//  if (this.indexChild < this.children.length-1)
//  {
//    this.indexChild++;
//    if (log) console.log("c: " + c + " Next child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
//    this.children[this.indexChild].start();
//  }
//}

// The first function is called by user event handleror current child.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementSeq.prototype.first = function(stop)
{
  if (this.indexChild > 0)
  {
    // First make the current child body element invisible and inactive

	if (stop)
	{
      // this.children[this.indexChild].state = 'inactive';
      // this.children[this.indexChild].bodyElement.style.display = 'none';
      //
      // Use method instead of direct manipulation
      //
      this.children[this.indexChild].stop(false)
	}
	
    // Then, move to prev child
    
    this.indexChild = 0;
    if (log) console.log("c: " + c + " Prev child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate();
  }
}

// The prev function is called by user event handler or current child.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementSeq.prototype.prev = function(stop)
{
  if (this.indexChild > 0)
  {
    // First make the current child body element invisible and inactive

	if (stop)
	{
      // this.children[this.indexChild].state = 'inactive';
      // this.children[this.indexChild].bodyElement.style.display = 'none';
      //
      // Use method instead of direct manipulation
      //
      this.children[this.indexChild].stop(false)
	}
    
    // Then, move to prev child
    
    this.indexChild--;
    if (log) console.log("c: " + c + " Prev child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate();
  }
}

// The next function is called by user event handler or current child.
// The "stop" parameter defines, whether the current active child has to be stopped first.

timedElementSeq.prototype.next = function(stop)
{
  if (this.indexChild < this.children.length-1)
  {
    // First make the current child body element invisible and inactive

	if (stop)
	{
      // this.children[this.indexChild].state = 'inactive';
      // this.children[this.indexChild].bodyElement.style.display = 'none';
      //
      // Use method instead of direct manipulation
      //
      this.children[this.indexChild].stop(false);
	}
	
    // Then, move to next child
    
    this.indexChild++;
    if (log) console.log("c: " + c + " Next child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
//  this.children[this.indexChild].activate();
    this.children[this.indexChild].start();
  }
}

// The last function is called by user event handleror current child.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementSeq.prototype.last = function(stop)
{
  if (this.indexChild < this.children.length-1)
  {
    // First make the current child body element invisible and inactive

	if (stop)
	{
      // this.children[this.indexChild].state = 'inactive';
      // this.children[this.indexChild].bodyElement.style.display = 'none';
      //
      // Use method instead of direct manipulation
      //
      this.children[this.indexChild].stop(false)
	}
	
    // Then, move to next child
    
    this.indexChild = this.children.length-1;
    if (log) console.log("c: " + c + " Next child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate();
  }
}

timedElementSeq.prototype.change = function(indexNumber)
{
  if (log) console.log("TimedElementSeq.change() called by: " + indexNumber);
  this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
  this.indexChild = indexNumber;
  if (log) console.log("indexChild: " + this.indexChild + ", Number of Childs: " + this.children.length);
//this.children[this.indexChild].activate(); // Method used instead of direct manipulation
  this.children[this.indexChild].start(); // Method used instead of direct manipulation
}

// The childStop function

timedElementSeq.prototype.childStop = function()
{
  if (log) console.log("c: " + c + " My child has stopped: " + this.nodeName);
  if (this.indexChild < this.children.length-1)
  {
    this.next(false);
  } else if (this.repeatCount < this.attributes.repeatCount)
  {
  	if (log) console.log("c: %i Repeating the element: %s", c, this.nodeName)
  	this.repeatCount++;
  	this.first();
  } else
  {
    this.stop(true);
  }
}

// The PAR TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementPar()
{
}

timedElementPar.prototype = new timedElement;

// The childStop function

timedElementPar.prototype.childStop = function()
{
  var i;
  var stopPar = true;  // Should I stop?
  
  if (log) console.log("c: " + c + " My child has stopped: " + this.nodeName);

  // Check whether all children have stopped
  
  for (i in this.children)
  {
  	if (this.children[i].state != "inactive")
  	  stopPar = false;
  }
  
  if (stopPar)
    this.stop(true);
}

timedElementPar.prototype.change = function(indexNumber)
{
  if (log) console.log("TimedElementPar.change() called by: " + indexNumber);
  this.indexChild = indexNumber;
  if (log) console.log("indexChild: " + this.indexChild + ", Number of Childs: " + this.children.length);
  this.children[this.indexChild].activate(); // Method used instead of direct manipulation
}
// The EXCL TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementExcl()
{
}

timedElementExcl.prototype = new timedElement;

// The change function is called by user event handler to change the current child.

timedElementExcl.prototype.start = function()
{
  if (log) console.log("c: " + c + " Starting timesheet element: " + this.nodeName);
  this.state = 'active';
  this.children[this.indexChild].start();
}

// The first function is called by user event handleror current child.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementExcl.prototype.first = function(stop)
{
  if (this.indexChild > 0)
  {
    // First make the current child body element invisible and inactive

	if (stop == "true")
	{
      this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
	}
	
    // Then, move to prev child
    
    this.indexChild = 0;
    if (log) console.log("c: " + c + " Prev child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate(); // Method used instead of direct manipulation
  }
}

// The prev function is called by user event handler.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementExcl.prototype.prev = function(stop)
{
  if (this.indexChild > 0)
  {
    // First make the current child body element invisible and inactive

	if (stop == "true")
	{
      this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
	}
    
    // Then, move to prev child
    
    this.indexChild--;
    if (log) console.log("c: " + c + " Prev child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate(); // Method used instead of direct manipulation
//  this.children[this.indexChild].start(); // Start used instead of activate
  }
}

// The next function is called by user event handler.
// The "stop" parameter defines, whether the current active child has to be stopped first.

timedElementExcl.prototype.next = function(stop)
{
  if (log) console.log("timedElementExcl.next called!");
  if (this.indexChild < this.children.length-1)
  {
    // First make the current child body element invisible and inactive

	if (stop == "true")
	{
      this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
	}
	
    // Then, move to next child
    
    this.indexChild++;
    if (log) console.log("c: " + c + " Next child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate(); // Method used instead of direct manipulation
//  this.children[this.indexChild].start(); // Start used instead of activate
  }
}

// The last function is called by user event handler.
// The "stop" parameter, define whether the current active child has to be stopped first.

timedElementExcl.prototype.last = function(stop)
{
  if (this.indexChild < this.children.length-1)
  {
    // First make the current child body element invisible and inactive

	if (stop == "true")
	{
      this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
	}
	
    // Then, move to next child
    
    this.indexChild = this.children.length-1;
    if (log) console.log("c: " + c + " Next child of timesheet element: " + this.nodeName + ", indexChild: " + this.indexChild);
    this.children[this.indexChild].activate(); // Method used instead of direct manipulation
  }
}

timedElementExcl.prototype.change = function(indexNumber)
{
  if (log) console.log("TimedElementExcl.change() called by: " + indexNumber);
  this.children[this.indexChild].stop(false); // Method used instead of direct manipulation
  this.indexChild = indexNumber;
  if (log) console.log("indexChild: " + this.indexChild + ", Number of Childs: " + this.children.length);
  this.children[this.indexChild].activate(); // Method used instead of direct manipulation
}
// The ITEM TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementItem()
{
}

timedElementItem.prototype = new timedElement;

// The start function

timedElementItem.prototype.start = function()
{
  var i;

  if (this.attributes.beginInternalEvent == null && this.attributes.beginUserEvent == null)
  {

    // Setup start time

    if (this.attributes.begin != null)
    {
      this.startTime = c + this.attributes.begin;
      this.state = 'waitTimerToStart';
      waitStart[this.startTime] = this;
    } else {
      this.startTime = c;
      this.activate();
    }
  } else
  {
    this.startTime = null;
  }

  if (log) console.log("c: " + c + " Starting timesheet element: " + this.nodeName + ", body element: " + this.bodyElement.id + ", startTime: " + this.startTime + ", stopTime: " + this.stopTime);
}

// The startInternalEvent function

timedElementItem.prototype.startInternalEvent = function()
{

  // Setup start time

  if (this.attributes.begin != null)
  {
    this.startTime = c + this.attributes.begin;
    this.state = 'waitTimerToStart';
    while (waitStart[this.startTime] != null)     // Check that array entry is empty!
    {
      this.startTime--;
    }
    waitStart[this.startTime] = this;
  } else {
    this.startTime = c;
    this.activate();
  }

  if (log) console.log("c: " + c + " Starting internal event timesheet element: " + this.nodeName + ", body element: " + this.bodyElement.id + ", startTime: " + this.startTime + ", stopTime: " + this.stopTime);
}

// The activate function

timedElementItem.prototype.activate = function()
{
  var i;

  // Set this element active and display it

  this.state = 'active';
  this.bodyElement.style.display = this.bodyElement.styleOriginal;

  // Start all children
  for (i in this.children)
  {
    this.children[i].start();
  }

  // Start all items waiting internal events from this element

  for (i in this.toStart)
  {
    if (log) console.log("c: " + c + " Starting items waiting internal event: " + this.toStart[i].nodeName + ", body element: " + this.toStart[i].bodyElement.id + ", startTime: " + this.toStart[i].startTime + ", stopTime: " + this.toStart[i].stopTime);

    this.toStart[i].startInternalEvent();
  }

  // Setup stop time

  if (this.attributes.dur != null)
  {
    this.stopTime = this.startTime + this.attributes.dur;
    while (waitStop[this.stopTime] != null)     // Check that array entry is empty!
    {
      this.stopTime++;
    }
    waitStop[this.stopTime] = this;
  } else {
    this.stopTime = null;
  }
}

// The stop function

timedElementItem.prototype.stop = function(inform)
{
  var i;
  if (log) console.log("c: " + c + " Stopping timesheet element: " + this.nodeName);

  // First, stop all the children

  for (i in this.children)
  {
    if (this.children[i].state != 'inactive') this.children[i].stop(false);
  }

  // Then make the body element invisible and inactive

  if (this.state == 'waitTimerToStart')
  	delete waitStart[this.startTime];
  if (this.state == 'waitTimerToStop')
  	delete waitStop[this.stopTime];
  this.state = 'inactive';
  this.bodyElement.style.display = 'none';

  // Inform parent about this

  if (inform) this.parent.childStop();
}

// The PREFETCH TimedElement
//
// (c) Petri Vuorimaa, 2007.

function timedElementPrefetch()
{
}

timedElementPrefetch.prototype = new timedElement;

// The start function

timedElementPrefetch.prototype.start = function()
{
	if (log) console.log("c: " + c + " Prefetching element: " + this.bodyElement.id);
	
	// Create XMLHttpRequest
	
	var xmlhttp=new XMLHttpRequest();
	var prefetchElement = this;
		
	// Request headers
	
	xmlhttp.open("HEAD",this.bodyElement.srcPrefetch,true);
	xmlhttp.onreadystatechange= function() {
    	if (xmlhttp.readyState==4)
			if (xmlhttp.status==200)
			{
                prefetchElement.contentLength = xmlhttp.getResponseHeader('Content-Length');
				prefetchElement.activate();
			}
    }
	xmlhttp.send(null);
}

timedElementPrefetch.prototype.activate = function()
{
	var xmlhttp=new XMLHttpRequest();
	var prefetchElement = this;
	var i;
	
	if (log) console.log("XMLHttp content length: %s", this.contentLength);

	// How much should I download?
	
	if (this.attributes.mediaSize == null)
		this.attributes.mediaSize = "100%";
	
	if (log) console.log("Media size: %s", this.attributes.mediaSize)
	
	if (this.attributes.mediaSize == "100%")
	{
		this.attributes.mediaSize = this.contentLength;
	} else
	{
		i = this.attributes.mediaSize.search(/%/);
		if (i > 0)
			this.attributes.mediaSize = Number(this.attributes.mediaSize.substr(0,i))*Number(this.contentLength)/100;
	}
	
	if (log) console.log("Media size: %s bytes", this.attributes.mediaSize)

	var range = this.attributes.mediaSize-1;
	range = "bytes=0-" + range;
	if (log) console.log("Range: %s", range);
	
	// Get element
	
	xmlhttp.open("GET",this.bodyElement.srcPrefetch,true);
	xmlhttp.onreadystatechange= function() {
    	if (xmlhttp.readyState==4)
			if (xmlhttp.status==200 || xmlhttp.status==206)
			{
				prefetchElement.stop(true);
			}
    }
	xmlhttp.setRequestHeader('Range', range);
	xmlhttp.send(null);	
}

// The stop function

timedElementPrefetch.prototype.stop = function(inform)
{
	if (log) console.log("Prefetch element id: %s loaded", this.bodyElement.id);
	
	this.bodyElement.setAttribute('src', this.bodyElement.srcPrefetch);

	if (log) console.log("c: " + c + " Stopping timesheet element: " + this.nodeName);

	// Inform parent about this

	if (inform) this.parent.childStop();
}

timedElementPrefetch.prototype.remove = function()
{
	var foundElements=new Array(); // Stores the found elements, which have correct elementClass
	var foundElementsCounter=0;    // IndexCounter for the foundElements array.
	var i;
	
	// The searchElementBySrc finds all elements, which have given elementSrc attribute.
	// It does a recursive search elementSrc by using the searchElementBySrc function.
	// In addition it removes the source, since it will later loaded by the prefetch element.

	function searchElementBySrc(elementSrc, currentElement)
    {
		var i;

		if (currentElement.attributes != null)
		{
			for (i=0;i<currentElement.attributes.length;i++)
			{

			if (currentElement.attributes[i].nodeName == "src")
			{
				if (currentElement.attributes[i].nodeValue == elementSrc)
				{
					foundElements[foundElementsCounter]=currentElement;
					if (log) console.log("Found element: %s, with src: %s", currentElement.id, elementSrc);
					currentElement.attributes[i].nodeValue = "";
					foundElementsCounter++;
				}
			}
		}
        for (i=1;i<currentElement.childNodes.length;i=i+2)
        {
          searchElementBySrc(elementSrc, currentElement.childNodes[i]);
        }
      }
    }

	if (log) console.log("Trying to remove prefetch element, src: %s", this.attributes.src);
    searchElementBySrc(this.attributes.src, document.body);
    this.toPrefetch = foundElements;
}
function timedElementAnimate()
{
}

timedElementAnimate.prototype = new timedElement;

timedElementAnimate.prototype.start = function()
{

  // Setup start time

  if (this.attributes.begin != null)
  {
    this.startTime = c + this.attributes.begin;
    this.state = 'waitTimerToStart'
    while (waitStart[this.startTime] != null)     // Check that array entry is empty!
    {
      this.startTime--;
    }
    waitStart[this.startTime] = this;
  } else {
    this.startTime = c;
    this.activate();
  }
}

timedElementAnimate.prototype.activate = function()
{
  animate[c] = this;

  // Setup stop time

  if (this.attributes.dur != null)
  {
    this.stopTime = this.startTime + this.attributes.dur;
    while (waitStop[this.stopTime] != null)     // Check that array entry is empty!
    {
      this.stopTime--;
    }
    waitStop[this.stopTime] = this;
  } else {
    this.stopTime = null;
  }
}

timedElementAnimate.prototype.animate = function()
{
  var i;
  var x;
   
  // Without the first special case the index i overflows and creates NaN values
  // for a and y. The seconde case is the normal.
  
  if (c >= this.stopTime)  
  {
  	x = 1;
  	i = this.attributes.values.length-2;
  } else
  {
    x = (this.attributes.values.length - 1)*(c - this.startTime)/(this.stopTime-this.startTime);
    i = Math.floor(x);
  	x = x - i;
  }

  var a = Number(this.attributes.values[i+1] - this.attributes.values[i]);
  var b = Number(this.attributes.values[i]);
  var y = a * x + b;
  // if (log) console.log("Animating element: " + this.bodyElement.id + ", Attribute: " + this.attributes.attributeName +  ", part: " + i + ", a: " + a + ", b: " + b + ", x: " + x + ", y: " + y + ", i: " + i);
  this.bodyElement.style[this.attributes.attributeName] = y + "px";
}
function timedElementSet()
{
}

timedElementSet.prototype = new timedElement;

timedElementSet.prototype.start = function()
{

	// Setup start time

	if (this.attributes.begin != null)
	{
    	this.startTime = c + this.attributes.begin;
    	this.state = 'waitTimerToStart'
    	while (waitStart[this.startTime] != null)     // Check that array entry is empty!
    	{
    		this.startTime--;
    	}
    	waitStart[this.startTime] = this;
  	} else {
    	this.startTime = c;
    	this.activate();
  	}
}

timedElementSet.prototype.activate = function()
{
	var i;
	
	// Set this element active
	
  	this.state = 'active';
	
	// Set the value
	
	if (this.attributes.attributeType == "XML")
	{
//		this.bodyElement.attributes[this.attributes.attributeName] = this.attributes.to;
//		for (i=0; i < this.bodyElement.attributes.length; i++)
//			if (this.bodyElement.attributes[i].nodeName == this.attributes.attributeName)
//				this.bodyElement.attributes[1].value = this.attributes.to;		
		this.bodyElement.setAttribute(this.attributes.attributeName, this.attributes.to);
		if (log) console.log("Set XML attribute %s to %s", this.attributes.attributeName, this.attributes.to);
	} else
	{
		this.bodyElement.style[this.attributes.attributeName] = this.attributes.to;
		if (log) console.log("Set CSS attribute %s to %s", this.attributes.attributeName, this.attributes.to);
	}

	// Setup stop time

	if (this.attributes.dur != null)
	{
		this.stopTime = this.startTime + this.attributes.dur;
    	this.state = 'waitTimerToStop'
		while (waitStop[this.stopTime] != null)     // Check that array entry is empty!
	{
 		this.stopTime--;
    }
    	waitStop[this.stopTime] = this;
	} else {
    	this.stopTime = null;
	}
}

// The stop function

timedElementSet.prototype.stop = function()
{
	if (log) console.log("c: " + c + " Stopping set element: " + this.nodeName);
  
	// Reset the value
	
	this.bodyElement.style[this.attributes.attributeName] = this.setValue;

	// Remove the element from the waitStart and waitStop queues
	
	if (this.state == 'waitTimerToStart')
		delete waitStart[this.startTime];
	if (this.state == 'waitTimerToStop')
		delete waitStop[this.stopTime];

	// Then make inactive

  	this.state = 'inactive';
}
function timedElementAnimateColor()
{
}

timedElementAnimateColor.prototype = new timedElement;

timedElementAnimateColor.prototype.start = function()
{

  // Setup start time

  if (this.attributes.begin != null)
  {
    this.startTime = c + this.attributes.begin;
    this.state = 'waitTimerToStart'
    while (waitStart[this.startTime] != null)     // Check that array entry is empty!
    {
      this.startTime--;
    }
    waitStart[this.startTime] = this;
  } else {
    this.startTime = c;
    this.activate();
  }
}

timedElementAnimateColor.prototype.activate = function()
{
  animate[c] = this;

  // Setup stop time

  if (this.attributes.dur != null)
  {
    this.stopTime = this.startTime + this.attributes.dur;
    while (waitStop[this.stopTime] != null)     // Check that array entry is empty!
    {
      this.stopTime--;
    }
    waitStop[this.stopTime] = this;
  } else {
    this.stopTime = null;
  }
}

timedElementAnimateColor.prototype.animate = function()
{	
	// A better place for this function could be within the create method
	// of this element, since the function really has to be run only once.
	
	function parseRGB(rgbArray)
	{
		function rgb(red, green, blue)	// Rgb values object
		{
			this.red = red;
			this.green= green;
			this.blue = blue;
		}
		
		var rgbValues = new Array();	// Result of the parsing
		var rgbString;					// Individual rgb strings
		var red;						// Red value
		var green;						// Green value
		var blue;						// Blue value
		var i;							// Index of values;
		var j;	      					// Index for searching colors in values

		for (i=0; i<rgbArray.length; i++)
		{
			rgbString = rgbArray[i];
			
			// Red
		
			j = rgbString.indexOf(",");
			red = Number(rgbString.substring(4, j));
			rgbString = rgbString.slice(j+1);
	
			// Green
		
			j = rgbString.indexOf(",");
			green = Number(rgbString.substring(0, j));
			rgbString = rgbString.slice(j+1);
		
			// Blue
		
			j = rgbString.indexOf(")");
			blue = Number(rgbString.substring(0, j));
		
			// Return the result
		
		    rgbValues[i] = new rgb(red, green, blue);	
		}
		return rgbValues;
	}
	
	var x;							// x is same for all colors
	var redA;						// Red coefficient
	var redB;						// Red value
	var redY;						// Red result
	var greenA;						// Green coefficient
	var greenB;						// Green value
	var greenY;						// Green result
	var blueA;						// Blue coefficient
	var blueB;						// Blue value
	var blueY;						// Blue result
	var rgbValues = new Array();	// Array of all values converted to individual rgb values
	var rgbY;						// The result rgb value
	var i;							// Index of individual values

	if (this.attributes.values[0].substr(0, 4) == "rgb(")
	{
		rgbValues = parseRGB(this.attributes.values);
   
		// Without the first special case the index i overflows and creates NaN values
		// for a and y. The seconde case is the normal.
  
		if (c >= this.stopTime)  
		{
			x = 1;
			i = this.attributes.values.length-2;
		} else
		{
			x = (this.attributes.values.length - 1)*(c - this.startTime)/(this.stopTime-this.startTime);
			i = Math.floor(x);
			x = x - i;
		}
		
		// Red
		
		redA = rgbValues[i+1].red - rgbValues[i].red;
		redB = rgbValues[i].red;
		redY = Math.round(redA * x + redB);
		
		// Green
		
		greenA = rgbValues[i+1].green - rgbValues[i].green;
		greenB = rgbValues[i].green;
		greenY = Math.round(greenA * x + greenB);
		
		// Blue
		
		blueA = rgbValues[i+1].blue - rgbValues[i].blue;
		blueB = rgbValues[i].blue;
		blueY = Math.round(blueA * x + blueB);
		
		// Create result
		
		rgbY = "rgb(" +redY + "," + greenY +"," + blueY +")";
		if (log) console.log("c: %i AnimateColor element %s: %s", c, this.bodyElement.id, rgbY);
		this.bodyElement.style[this.attributes.attributeName] = rgbY;
	} else
	{
		if (log) console.warn("AnimateColor supports only rgb values");
	}
}
function timedElementAnimateMotion()
{
}

timedElementAnimateMotion.prototype = new timedElement;

timedElementAnimateMotion.prototype.start = function()
{

  // Setup start time

  if (this.attributes.begin != null)
  {
    this.startTime = c + this.attributes.begin;
    this.state = 'waitTimerToStart'
    while (waitStart[this.startTime] != null)     // Check that array entry is empty!
    {
      this.startTime--;
    }
    waitStart[this.startTime] = this;
  } else {
    this.startTime = c;
    this.activate();
  }
}

timedElementAnimateMotion.prototype.activate = function()
{
  animate[c] = this;

  // Setup stop time

  if (this.attributes.dur != null)
  {
    this.stopTime = this.startTime + this.attributes.dur;
    while (waitStop[this.stopTime] != null)     // Check that array entry is empty!
    {
      this.stopTime--;
    }
    waitStop[this.stopTime] = this;
  } else {
    this.stopTime = null;
  }
}

timedElementAnimateMotion.prototype.animate = function()
{	
	// A better place for this function could be within the create method
	// of this element, since the function really has to be run only once.
	
	function parseMotion(motionArray)
	{
		function motion(x,y)	// x, y values object
		{
			this.x = x;
			this.y = y;
		}
		
		var motionValues = new Array();	// Result of the parsing
		var motionString;				// Individual x, y strings
		var x;							// x value
		var y;							// y value
		var i;							// Index of values;
		var j;	      					// Index for searching colors in values
		
		for (i=0; i<motionArray.length; i++)
		{
			motionString = motionArray[i];
			
			// x
		
			j = motionString.indexOf(",");
			x = Number(motionString.substring(0, j));
			motionString = motionString.slice(j+1);

			// y
		
			j = motionString.length;
			y = Number(motionString.substring(0, j));

			// Return the result
		
		    motionValues[i] = new motion(x, y);	
		}
		return motionValues;		
	}
	
	var x;							// z is same for all colors
	var xA;							// x coefficient
	var xB;							// x value
	var xY;							// x result
	var yA;							// y coefficient
	var yB;							// y value
	var yY;							// y result
	var motionValues = new Array();	// Array of all values converted to individual rgb values
	var motionY;					// The result motion value
	var i;							// Index of individual values
	
	motionValues = parseMotion(this.attributes.values);
   
	// Without the first special case the index i overflows and creates NaN values
	// for a and y. The seconde case is the normal.
  
	if (c >= this.stopTime)  
	{
		x = 1;
		i = this.attributes.values.length-2;
	} else
	{
		x = (this.attributes.values.length - 1)*(c - this.startTime)/(this.stopTime-this.startTime);
		i = Math.floor(x);
		x = x - i;
	}
		
	// Red
		
	xA = motionValues[i+1].x - motionValues[i].x;
	xB = motionValues[i].x;
	xY = Math.round(xA * x + xB);
		
	// Green
		
	yA = motionValues[i+1].y - motionValues[i].y;
	yB = motionValues[i].y;
	yY = Math.round(yA * x + yB);
		
	// Create result
		
	motionY = xY + "," + yY;
	if (log) console.log("c: %i AnimateMotion element %s: %s", c, this.bodyElement.id, motionY);
	
	// This is a simple hack. The positioning should be more general.
	
 	this.bodyElement.style.marginLeft = xY+"px";	
	this.bodyElement.style.marginTop = yY+"px";	
}// The parseAttributes method parses the attributes of the timecontainers
// and item elements in the timesheet.
// It stores information about the CSS Selectors, begin, end, dur, etc. attributes.
//
// (c) Petri Vuorimaa, 2007.

timedElement.prototype.parseAttributes = function(attributes, indexNumber)
{
  var i;
  var j;
  var k;
  var valueString;      // Stores temporally the value string
  var eventId = null;   // Stores temporally the eventId
  var eventTime = null; // Stores temporally the eventTime

  //  These variables are used by index function

  var indexId = null;      // IndexId in begin
  var indexPostfix = null; // Postfix in begin
  var indexStart = 0;      // Start of the Index

  // The calculateTime converts the time string to milliseconds.
  // Currently, it supports only Timecount values (i.e., ms, s, min, and hour).
  // Full-Clock and Partial-Clock values are not supported.

  function calculateTime(timeString)
  {
    var i;
    var j;

    // Empty TimeString

    if (timeString == "")
    {
      return 0;
    }

    // Timecount Milliseconds

    i = timeString.search(/ms/)
    if (i > 0)
    {
      return Number(timeString.substr(0,i));
    }

    // Timecount Seconds

    i = timeString.search(/s/)
    if (i > 0)
    {
      return Number(timeString.substr(0,i))*1000;
    }

    // Timecount Minutes

    i = timeString.search(/min/)
    if (i > 0)
    {
      return Number(timeString.substr(0,i))*60*1000;
    }

    // Timecount Hours

    i = timeString.search(/h/)
    if (i > 0)
    {
      return Number(timeString.substr(0,i))*60*60*1000;
    }
  }

  // Here is the actual ParseTime Function

  this.attributes = new Array();
  this.attributes.id = null;                 // ID
  this.attributes.select = null;             // Selector
  this.attributes.begin = null;              // Begin time
  this.attributes.dur = null;                // Duration
  this.attributes.end = null;                // End time
  this.attributes.beginInc = null;           // Begin time increment
  this.attributes.durInc = null;             // Dur time increment
  this.attributes.endInc = null;             // End time increment
  this.attributes.beginInternalEvent = null; // Timesheet internal begin event
  this.attributes.endInternalEvent = null;   // Timesheet internal end event
  this.attributes.beginUserEvent = null;     // Timesheet internal begin event
  this.attributes.endUserEvent = null;       // Timesheet internal end event
  this.attributes.repeatCount = null;		 // RepeatCount
  this.attributes.repeatDur = null;			 // RepeatDur

  // The following attributes are currently used both by SEQ and EXCL time containers

  this.attributes.firstUserEvent = null;     // first item
  this.attributes.prevUserEvent = null;      // prev item
  this.attributes.nextUserEvent = null;      // next item
  this.attributes.lastUserEvent = null;      // last item

  // The following attributes are only used by prefetch
  
  this.attributes.mediaSize = null;          // mediaSize
  this.attributes.mediaTime = null;          // mediaSize
  this.attributes.bandwidth = null;          // mediaSize
  
  // The following attributes are only used by animation elements animate, set, animateMotion, and animateColor

  this.attributes.attributeName = null;      // Target attribute
  this.attributes.attributeType = null;      // Target attribute type
  this.attributes.values = new Array();      // Animation values
  this.attributes.from = null;               // From attribute
  this.attributes.to = null;                 // To attribute
  this.attributes.by = null;                 // By attribute

  for (i=0;i<attributes.length;i++)
  {
    switch (attributes[i].nodeName)
    {
      case "indexStart":
        indexStart = attributes[i].nodeValue;
        break;
      case "id":
        this.attributes.id = attributes[i].nodeValue;
        break;
      case "select":
        this.attributes.select = attributes[i].nodeValue;
        break;
      case "begin":

        // Look for IDs in timestring

        j = attributes[i].nodeValue.search(/\+/);
        if (j > 0)
        { 
          eventId = attributes[i].nodeValue.substr(0, j);
          eventTime = calculateTime(attributes[i].nodeValue.substr(j));
          if (log) console.log("ID in beginTime found: " + eventId + ", Begin time is: " + attributes[i].nodeValue.substr(j));
        } else
        {
          eventTime = calculateTime(attributes[i].nodeValue);
        }

        if (isNaN(eventTime)) // The whole begin string must be ID without timevalue
        {
          eventId = attributes[i].nodeValue
          eventTime = null;
          if (log) console.log("ID without time in beginTime found: " + eventId + ", Begin time is: " + eventTime);
        }
        
        // Check whether the event is internal or external
        // User events have format elementId.eventName
        // or they have an accesskey
        // This assumption may not be valid in later versions!

        if (eventId != null)
        {
          if (eventId.search(/\./) > 0)
          {
            if (log) console.log("User event found: " + eventId);           

            // Look for index function

            if (eventId.substr(0, 6) == "index(")
            {
              j = attributes[i].nodeValue.search(/\)/);
              k = attributes[i].nodeValue.length-j-1;
              indexId = eventId.substr(6, j-6);
              indexPostfix = eventId.substr(j+1, k);
              var tmp = Number(indexStart) + Number(indexNumber);
              eventId = indexId + tmp + indexPostfix;
              if (log) console.log("Index function found, indexId: " + indexId + ", postfix: " + indexPostfix + ", new eventId: " + eventId);
            }
            this.attributes.beginUserEvent = eventId;
          } else if (eventId.substr(0, 10) == "accesskey(") // Look for accesskey
          {
              if (log) console.log("Accesskey found, eventId: %s", eventId);
              this.attributes.beginUserEvent = eventId;
          } else
          {
            if (log) console.log("Internal event found: " + eventId);           
            this.attributes.beginInternalEvent = eventId;
          }
        }
        this.attributes.begin = eventTime;

        break;

      case "dur":
        this.attributes.dur = calculateTime(attributes[i].nodeValue);
        break;

      case "end":

        // Look for IDs in timestring

        j = attributes[i].nodeValue.search(/\+/);
        if (j > 0)
        { 
          eventId = attributes[i].nodeValue.substr(0, j);
          eventTime = calculateTime(attributes[i].nodeValue.substr(j));
          if (log) console.log("ID in endTime found: " + eventId + ", End time is: " + attributes[i].nodeValue.substr(j));
        } else
        {
          eventTime = calculateTime(attributes[i].nodeValue);
        }

        if (isNaN(eventTime)) // The whole begin string must be ID without timevalue
        {
          eventId = attributes[i].nodeValue
          eventTime = null;
          if (log) console.log("ID without time in endTime found: " + eventId + ", End time is: " + eventTime);
        }
        
        // Check whether the event is internal or external
        // User events have format elementId.eventName
        // This assumption may not be valid in later versions!

        if (eventId != null)
        {
          if (eventId.search(/\./) > 0)
          {
            if (log) console.log("User event found: " + eventId);           
            this.attributes.endUserEvent = eventId;
          } else
          {
            if (log) console.log("Internal event found: " + eventId);           
            this.attributes.endInternalEvent = eventId;
          }
        }
        this.attributes.end = eventTime;
        break;

      case "beginInc":
        this.attributes.beginInc = calculateTime(attributes[i].nodeValue);
        break;

      case "durInc":
        this.attributes.durInc = calculateTime(attributes[i].nodeValue);
        break;

      case "endInc":
        this.attributes.endInc = calculateTime(attributes[i].nodeValue);
        break;

      case "first":
        this.attributes.firstUserEvent = attributes[i].nodeValue;
        if (log) console.log("First user event found: " + this.attributes.firstUserEvent);           
        break;

      case "prev":
        this.attributes.prevUserEvent = attributes[i].nodeValue;
        if (log) console.log("Prev user event found: " + this.attributes.prevUserEvent);           
        break;

      case "next":
        this.attributes.nextUserEvent = attributes[i].nodeValue;
        if (log) console.log("Next user event found: " + this.attributes.nextUserEvent);           
        break;

      case "last":
        this.attributes.lastUserEvent = attributes[i].nodeValue;
        if (log) console.log("Last user event found: " + this.attributes.lastUserEvent);           
        break;

      case "attributeName":
        this.attributes. attributeName = attributes[i].nodeValue;
        break;

      case "attributeType":
        this.attributes. attributeType = attributes[i].nodeValue;
        break;

      case "values":
        valueString = attributes[i].nodeValue;
        if (log) console.log("Values attribute found: " + valueString);
        j = 0;
        k = valueString.search(/;/)
        while (k > 0)
        {
          this.attributes.values[j] = valueString.substr(0,k)
          valueString =  valueString.substr(k+1);
          k = valueString.search(/;/)
          j++;
        }
        this.attributes.values[j] = valueString;
        break;

	  case "src":
	  	this.attributes.src = attributes[i].nodeValue;
	  	break;

	  case "media":
	    if (log) console.warn("media is not yet implemented!");
	  	this.attributes.media = attributes[i].nodeValue;
	  	break;

	  case "from":
	  	this.attributes.from = attributes[i].nodeValue;
	  	break;

	  case "to":
	  	this.attributes.to = attributes[i].nodeValue;
	  	break;

	  case "by":
	  	this.attributes.by = attributes[i].nodeValue;
	  	break;
	  	
	  case "mediaSize":
	  	this.attributes.mediaSize = attributes[i].nodeValue;
	  	break;

	  case "mediaTime":
	    if (log) console.warn("mediaTime is not yet implemented!");
	  	this.attributes.mediaTime = attributes[i].nodeValue;
	  	break;

	  case "bandwidth":
	    if (log) console.warn("bandwidth is not yet implemented!");
	  	this.attributes.bandwidth = attributes[i].nodeValue;
	  	break;
	  	
	  case "repeatCount":
	    if (log) console.warn("repeatCount does not yet support partial repeat!");
	  	this.attributes.repeatCount = attributes[i].nodeValue;
	  	break;

	  case "repeatDur":
	    if (log) console.warn("repeatDur is not yet implemented!");
	  	this.attributes.repeatDur = attributes[i].nodeValue;
	  	break;
	  	
	  case "fill":
	    if (log) console.warn("fill is not yet implemented!");
	  	this.attributes.fill = attributes[i].nodeValue;
	  	break;

	  case "endSync":
	    if (log) console.warn("endSync is not yet implemented!");
	  	this.attributes.endSync = attributes[i].nodeValue;
	  	break;

      case "xmlns":
      	break;
      		  	
      default:
        if (log) console.warn("Unknown attribute: " + attributes[i].nodeName);
    }    
  }
  
	// Convert from, to, and by to values
  
  	if (this.attributes.from != null || this.attributes.to != null || this.attributes.by != null) // Is neither from, to, or by is defined, there is no need to go further
  	{
  		if (this.attributes.values[0] == null) // values is not defined, everything is ok
  		{
			if (this.attributes.from != null) // from is defined, that's usual case
			{
				if (this.attributes.to != null) // from and to are defined
				{
 					if (log) console.log("from and to are defined, while values is not defined");
					this.attributes.values[0] = this.attributes.from;
					this.attributes.values[1] = this.attributes.to;
				} else if (this.attributes.by != null) // from and by are defined
				{
					if (log) console.log("from and by are defined, while values is not defined");
					this.attributes.values[0] = this.attributes.from;
					this.attributes.values[1] = Number(this.attributes.from) + Number(this.attributes.by);
				} else // from is defined, but neither to or by is defined, give a warning
				{
					if (log) console.warn("from is defined alone, while neither to or by are defined");
				}
			} else // from is not defined, that's a special case
			{
				if (log) console.warn("to or by defined, while from is not defined - not implemented yet")
			}
  		} else // values is also defined, give warning
  		{
  			if (log) console.warn("from, to, or by defined, while values is also defined")
  		}
  	}
}
// This function implements the registerUser method of // timedElement object.
// It looks for user events in timesheet tree. When it finds a user event it
// registers a general event handler for the event.
//
// (c) Petri Vuorimaa, 2007.

timedElement.prototype.registerUser = function()
{
  var eventElement;   // Stores temporally the eventElement
  var eventType;      // Stores temporally the eventType
  var fullName;       // eventElement + eventType
  var element;        // Reference to the element firing the event
  var accessKey;      // Access key value
  var i;
  var j;

  // BeginUserEvent

  if (this.attributes.beginUserEvent != null)
  {
    // User events have format elementId.eventName
    // This assumption may not be valid in later versions!
	
    i = this.attributes.beginUserEvent.search(/\./);
    eventElement = this.attributes.beginUserEvent.substr(0,i);
    eventType = this.attributes.beginUserEvent.substr(i+1);
    
    // Check whether the eventElement is the whole document
    
    if (eventElement == "document")
    {
    	document.addEventListener(eventType, userEventHandler, false);
	    if (log) console.log("User event listener registered, Element: document, Type: " + eventType);

	    // Store the element in userEvents array
	
		fullName = "#document." + eventType;
    	if (userBeginEvents[fullName] == null)
    	{
      		userBeginEvents[fullName] = this;
    	}
    } else
    {
	    element = document.getElementById(eventElement);
    	element.addEventListener(eventType, userEventHandler, false);
	    if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

	    // Store the element in userEvents array
	
		fullName = element.id + "." + eventType;
    	if (userBeginEvents[fullName] == null)
    	{
      		userBeginEvents[fullName] = this;
    	}
    }
  }

  // EndUserEvent

  if (this.attributes.endUserEvent != null)
  {
    // User events have format elementId.eventName
    // This assumption may not be valid in later versions!

    i = this.attributes.endUserEvent.search(/\./);
    eventElement = this.attributes.endUserEvent.substr(0,i);
    eventType = this.attributes.endUserEvent.substr(i+1);

    // Check whether the eventElement is the whole document
    
    if (eventElement == "document")
    {
    	document.addEventListener(eventType, userEventHandler, false);
	    if (log) console.log("User event listener registered, Element: document, Type: " + eventType);

	    // Store the element in userEvents array
	
		fullName = "#document." + eventType;
    	if (userEndEvents[fullName] == null)
    	{
      		userEndEvents[fullName] = this;
    	}
    } else
    {
    	element = document.getElementById(eventElement);
    	element.addEventListener(eventType, userEventHandler, false);
    	if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

    	// Store the element in userEvents array

		fullName = element.id + "." + eventType;
    	if (userEndEvents[fullName] == null)
    	{
      		userEndEvents[fullName] = this;
    	}
    }
  }

  // FirstUserEvent

  if (this.attributes.firstUserEvent != null)
  {

    // Does the user event have accesskey?

    i = this.attributes.firstUserEvent.search(/\)/);
    if (this.attributes.firstUserEvent.substr(0,9) == "accesskey")
    {
      accessKey = this.attributes.firstUserEvent.substr(10,i-10);
      if (log) console.log("Accesskey found: " + accessKey);

      // Store the access key in userEvents array

      if (userFirstEvents[accessKey] == null)
      {
        userFirstEvents[accessKey] = this;
      }
    } else
    {
      // User events have format elementId.eventName
      // This assumption may not be valid in later versions!

      i = this.attributes.firstUserEvent.search(/\./);
      eventElement = this.attributes.firstUserEvent.substr(0,i);
      eventType = this.attributes.firstUserEvent.substr(i+1);
      element = document.getElementById(eventElement);
      element.addEventListener(eventType, userEventHandler, false);
      if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

      // Store the element in userEvents array

      if (userFirstEvents[element.id] == null)
      {
        userFirstEvents[element.id] = this;
      }
    }
  }

  // PrevUserEvent

  if (this.attributes.prevUserEvent != null)
  {

    // Does the user event have accesskey?

    i = this.attributes.prevUserEvent.search(/\)/);
    if (this.attributes.prevUserEvent.substr(0,9) == "accesskey")
    {
      accessKey = this.attributes.prevUserEvent.substr(10,i-10);
      if (log) console.log("Accesskey found: " + accessKey);

      // Store the access key in userEvents array

      if (userPrevEvents[accessKey] == null)
      {
        userPrevEvents[accessKey] = this;
      }
    } else
    {

      // User events have format elementId.eventName
      // This assumption may not be valid in later versions!

      i = this.attributes.prevUserEvent.search(/\./);
      eventElement = this.attributes.prevUserEvent.substr(0,i);
      eventType = this.pattributes.revUserEvent.substr(i+1);
      element = document.getElementById(eventElement);
      element.addEventListener(eventType, userEventHandler, false);
      if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

      // Store the element in userEvents array

      if (userPrevEvents[element.id] == null)
      {
        userPrevEvents[element.id] = this;
      }
    }
  }

  // NextUserEvent

  if (this.attributes.nextUserEvent != null)
  {

    // Does the user event have accesskey?

    i = this.attributes.nextUserEvent.search(/\)/);
    if (this.attributes.nextUserEvent.substr(0,9) == "accesskey")
    {
      accessKey = this.attributes.nextUserEvent.substr(10,i-10);
      if (log) console.log("Accesskey found: " + accessKey);

      // Store the access key in userEvents array

      if (userNextEvents[accessKey] == null)
      {
        userNextEvents[accessKey] = this;
      }
    } else
    {

      // User events have format elementId.eventName
      // This assumption may not be valid in later versions!

      i = this.attributes.nextUserEvent.search(/\./);
      eventElement = this.attributes.nextUserEvent.substr(0,i);
      eventType = this.attributes.nextUserEvent.substr(i+1);
      element = document.getElementById(eventElement);
      element.addEventListener(eventType, userEventHandler, false);
      if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

      // Store the element in userEvents array

      if (userNextEvents[element.id] == null)
      {
        userNextEvents[element.id] = this;
      }
    }
  }

  // LastUserEvent

  if (this.attributes.lastUserEvent != null)
  {

    // Does the user event have accesskey?

    i = this.attributes.lastUserEvent.search(/\)/);
    if (this.attributes.lastUserEvent.substr(0,9) == "accesskey")
    {
      accessKey = this.attributes.lastUserEvent.substr(10,i-10);
      if (log) console.log("Accesskey found: " + accessKey);

      // Store the access key in userEvents array

      if (userLastEvents[accessKey] == null)
      {
        userLastEvents[accessKey] = this;
      }
    } else
    {

      // User events have format elementId.eventName
      // This assumption may not be valid in later versions!

      i = this.attributes.lastUserEvent.search(/\./);
      eventElement = this.attributes.lastUserEvent.substr(0,i);
      eventType = this.attributes.lastUserEvent.substr(i+1);
      element = document.getElementById(eventElement);
      element.addEventListener(eventType, userEventHandler, false);
      if (log) console.log("User event listener registered, Element: " + element.id + ", Type: " + eventType);

      // Store the element in userEvents array

      if (userLastEvents[element.id] == null)
      {
        userLastEvents[element.id] = this;
      }
    }
  }

  // Loop all children

  for (j=0; j < this.children.length; j++)
  {
    this.children[j].registerUser();
  }

}

// UserEventsHandler is the general handler of user events
// It first find the corresponding timesheet element
// and the manipulates the general clock
//
// (c) Petri Vuorimaa, 2007.

function userEventHandler(e)
{
  var target;	// Target element
  var source;	// Event source
  var fullName;	// eventElement + eventType

  
  if (this.nodeName == "#document")
  {
  	source = this.nodeName;
  } else
  {
  	source = this.id;
  }
  fullName = source + "." + e.type;
  if (log) console.log("Received event from element id: %s, type: %s, fullName: %s", source, e.type, fullName);

  // There can be only one active element per user event
  // If there are more than one, each event moves to the next element

  if (userBeginEvents[fullName] != null)
  {
    target = userBeginEvents[fullName];
    target.startTime = c;
    if (log) console.log("User Begin Event activated at time point " + target.startTime);
    if (target.parent.localName == "excl")
    {
      if (target.bodyElement != null)
      {
        if (log) console.log("Excl: " + target.indexNumber);
        target.parent.change(target.indexNumber);
      }
    } else if (target.parent.localName == "seq")
    {
      if (target.bodyElement != null)
      {
        if (log) console.log("Seq: " + target.indexNumber);
        target.parent.change(target.indexNumber);
      }
    } else if (target.parent.localName == "par")
    {
      if (target.bodyElement != null)
      {
        if (log) console.log("Par: " + target.indexNumber);
        target.parent.change(target.indexNumber);
      }
    }

  // User End Event
  
  } else if (userEndEvents[fullName] != null)
  {
    target = userEndEvents[fullName];
//  userEndEvents[fullName] = null;   //Reset the user event handler
    target.stopTime = c;
    if (log) console.log("User End Event activated at time point " + target.stopTime);
    if (target.parent.localName == "seq")
    {
      target.parent.next();
    } else if (target.parent.localName == "par")
    {
      target.stop(true);
    }
    

  // User First Event
  
  } else if (userFirstEvents[source] != null)
  {
    target = userFirstEvents[source];
    if (log) console.log("User First Event activated at time point " + c);
    if (target.localName == "seq")
    {
      target.first();
    }

  // User Prev Event
  
  } else if (userPrevEvents[source] != null)
  {
    target = userPrevEvents[source];
    if (log) console.log("User Prev Event activated at time point " + c);
    if (target.localName == "seq")
    {
      target.prev();
    }

  // User Next Event
  
  } else if (userNextEvents[source] != null)
  {
    target = userNextEvents[source];
    if (log) console.log("User Next Event activated at time point " + c);
    if (target.localName == "seq")
    {
      target.next();
    }

  // User Last Event
  
  } else if (userLastEvents[source] != null)
  {
    target = userLastEvents[source];
    if (log) console.log("User Last Event activated at time point " + c);
    if (target.localName == "seq")
    {
      target.last();
    }
  }
}
// keydownHandler is the general handler of keydown events
//
// (c) Petri Vuorimaa, 2007.

function keydownHandler(event)
{
  var accessKey; // Access Key Value
 
  switch (event.which)
  {
  case 35:
    accessKey = "End";
    if (log) console.log("Access key: " + accessKey);
    break;
  case 36:
    accessKey = "Home";
    if (log) console.log("Access key: " + accessKey);
    break;
  case 37:
    accessKey = "Left";
    if (log) console.log("Access key: " + accessKey);
    break;
  case 39:
    accessKey = "Right";
    if (log) console.log("Access key: " + accessKey);
    break;
  default:
    accessKey = String.fromCharCode(event.which);
    if (log) console.log("Key Event: " + accessKey);
  }

  if (userFirstEvents[accessKey] != null)
  {
    target = userFirstEvents[accessKey];
    if (log) console.log("User First Event activated at time point " + c);
    if (target.localName == "seq" || target.localName == "excl")
    {
      target.first("true");
    }
  } else if (userPrevEvents[accessKey] != null)
  {
    target = userPrevEvents[accessKey];
    if (log) console.log("User Prev Event activated at time point " + c);
    if (target.localName == "seq" || target.localName == "excl")
    {
      target.prev("true");
    }
  } else if (userNextEvents[accessKey] != null)
  {
    target = userNextEvents[accessKey];
    if (log) console.log("User Next Event activated at time point " + c);
    
    if (target.localName == "seq" || target.localName == "excl")
    {    	
      target.next("true");
    }
  } else if (userLastEvents[accessKey] != null)
  {
    target = userLastEvents[accessKey];
    if (log) console.log("User Last Event activated at time point " + c);
    if (target.localName == "seq" || target.localName == "excl")
    {
      target.last("true");
    }
  }
}
// The Timer Function controls the timing of the timedElements.
// It reads the timing information from the timedElements array
// and calls the timedElement start and stop methods according
// to the timing information.
//
// (c) Petri Vuorimaa, 2007.

function Timer()
{
  var time; // Time value used as index either in waitStart or waitStop

  for (time in waitStart)
  {
    if (c >= time)
    {
      waitStart[time].activate();
      delete waitStart[time];
    }
  }
  
  for (time in animate)
  {
    animate[time].animate();
    if (c >= animate[time].stopTime)
    {
      delete animate[time];
    }
  }

  for (time in waitStop)
  {
    if (c >= time)
    {
      waitStop[time].stop(true);
      delete waitStop[time];
    }
  }

  c=c+100
  t=setTimeout("Timer()",100)
}

// This the main function of the timesheets engine,
// which should be called from the xhtml file.
//
// (c) Petri Vuorimaa, 2007.

function timesheetEngine(debug)

{
  var xmlhttp=new XMLHttpRequest();	 // For accessing external timesheet file

  // This is the main program.

  // show log?
  
  if (debug=="debug")
  {
  	log = true;
  }
  if (log) console.log("Parsing Timesheet");
    
	// First, check whether the timesheet is external file

	var srcFile = document.getElementsByTagNameNS("http://www.w3.org/2007/07/SMIL30/Timesheets","timesheet")[0].getAttribute('src');
	if (srcFile != null)
	{
		if (log) console.log("External timesheet file: %s", srcFile)
 
		// Get element
	
		xmlhttp.open("GET",srcFile,false);
		xmlhttp.overrideMimeType('text/xml');  // otherwise responseXML does not work!!!
		xmlhttp.onreadystatechange= function()
		{
			if (xmlhttp.readyState==4)
				if (xmlhttp.status==200)
				{
//					document.getElementsByTagName("timesheet")[0].innerHTML=xmlhttp.responseText;
					if (log) console.log("External timesheet loaded, status: %s", xmlhttp.status);
					externalTimesheet = xmlhttp.responseXML.getElementsByTagNameNS("http://www.w3.org/2007/07/SMIL30/Timesheets", "timesheet")[0];
					var localTimesheet = document.getElementsByTagNameNS("http://www.w3.org/2007/07/SMIL30/Timesheets", "timesheet")[0];
					localTimesheet.parentNode.replaceChild(externalTimesheet, localTimesheet);
				}
		}
		xmlhttp.send(null);	
	}

  // Check media
  
  mediaInspector = document.getElementById('mediaInspector');
  if (mediaInspector != null)
  {
    if (mediaInspector.currentStyle) { 							// IE
      zIndex = mediaInspector.currentStyle['zIndex'];
    } else if (window.getComputedStyle) {						// Mozilla, Opera
      zIndex = window.getComputedStyle(mediaInspector, '').getPropertyValue("z-index");
    }
    switch (parseInt(zIndex))
    {
      case 5:
        media="print";
        break;
      case 6:
        media="projection";
        break;
      case 7:
        media="screen";
        break;
    }
  } else
  {
  	media="screen";
  }
  	
  var timesheetMedia = document.getElementsByTagNameNS("http://www.w3.org/2007/07/SMIL30/Timesheets", "timesheet")[0].getAttribute('media');
  
  if (timesheetMedia == null || timesheetMedia == media)
  {
  	// Everything ok, create first the TimedElement tree
  	
    if (log) console.log("Creating TimedElement Tree, media: %s", media);
    timesheet = new timedElementTimesheet;
    timesheet.create(document.getElementsByTagNameNS("http://www.w3.org/2007/07/SMIL30/Timesheets", "timesheet")[0], null, document.getElementsByTagName("body")[0], null);
 
    // Then, register the internal events

    if (log) console.log("Registering Internal Events!");
    timesheet.registerInternal();
  
    // Then, register the user events

     if (log) console.log("Registering User Events!");
     timesheet.registerUser();
  
    // In addtion, register keydown event handler

    document.onkeydown = keydownHandler;
    
    // Then, start the timesheet

    if (log) console.log("Starting Timesheet!");
    timesheet.start();

    // Finally, it stars the timer by calling the Timer function

    if (log) console.log("Starting Timer!");
    Timer();
  } else
  {
  	if (log) console.log("media: %s and timesheetMedia: %s do not match -> timesheet not used", media, timesheetMedia);
  }
    
}